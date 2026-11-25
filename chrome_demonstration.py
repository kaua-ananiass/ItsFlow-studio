"""Validated demonstration -> editable Chrome section; never executes actions."""
import base64,copy,io,re,tempfile
from PIL import Image
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit

def project(events):
    if not isinstance(events,list) or not 1<=len(events)<=50:raise ValueError('Demonstre de 1 a 50 ações por trecho.')
    steps=[]
    for index,event in enumerate(events,1):
        if not isinstance(event,dict):raise ValueError('Ação inválida.')
        first_step=len(steps)
        kind=event.get('kind');label=str(event.get('label') or 'Etapa')[:100]
        if kind=='navigate':
            parsed=urlsplit(str(event.get('url') or ''))
            if parsed.scheme not in ('http','https') or not parsed.hostname or parsed.username or parsed.password:raise ValueError('Página inválida na demonstração.')
            steps.append(dict(type='navigate',url=urlunsplit(parsed),title=label))
        elif kind in ('observe','desktop_click','desktop_text','desktop_validation'):
            if event.get('requires_confirmation') and not event.get('confirmed'):raise ValueError('Confirme os blocos selecionados antes de importar.')
            image=event.get('image') or {};data=image.get('data_url','') if isinstance(image,dict) else ''
            match=re.fullmatch(r'data:image/(png|jpeg);base64,([A-Za-z0-9+/=]+)',data) if isinstance(data,str) and len(data)<=410000 else None
            if not match:raise ValueError('Captura da mensagem inválida. Faça um novo recorte.')
            try:
                raw=base64.b64decode(match[2],validate=True)
                with Image.open(io.BytesIO(raw)) as picture:
                    if picture.format not in ('PNG','JPEG') or picture.width>1200 or picture.height>800 or picture.width<1 or picture.height<1:raise ValueError('Dimensões inválidas.')
                    picture.verify()
            except Exception as error:raise ValueError('Não foi possível validar a imagem da mensagem.') from error
            text=str(event.get('text') or '').strip()[:500] if kind=='observe' or event.get('recognition')=='ocr' else ''
            if event.get('recognition')=='image':text=''
            if event.get('recognition')=='ocr' and not text:raise ValueError('Informe o texto esperado no reconhecimento OCR.')
            success=event.get('on_success','parar' if kind=='desktop_validation' else 'continuar')
            failure=event.get('on_failure','continuar' if kind=='desktop_validation' else 'parar')
            if success not in ('continuar','parar') or failure not in ('continuar','parar'):raise ValueError('Comportamento de reconhecimento inválido.')
            clicks=event.get('clicks',1)
            if type(clicks)!=int or clicks not in (1,2):raise ValueError('Escolha 1 ou 2 cliques.')
            step=dict(type='ocr_text' if text else 'visual_match',title=('Validação · ' if kind=='desktop_validation' else '')+label,click=kind in ('desktop_click','desktop_text'),clicks=clicks,timeout_ms=8000,on_success={'action':success},on_failure={'action':failure})
            if text:
                step.update(text=text,action='clicar' if step['click'] else 'continuar',preview_image={'data_url':data})
                if event.get('source')=='selection':
                    step['visual_fallback']={'data_url':data}
                    region=event.get('ocr_region',dict(x=0,y=0,width=1,height=1))
                    if not isinstance(region,dict) or any(type(region.get(k)) not in (float,int) for k in ('x','y','width','height')):raise ValueError('Região OCR inválida.')
                    if not (0<=region['x']<1 and 0<=region['y']<1 and 0<region['width']<=1-region['x']+1e-8 and 0<region['height']<=1-region['y']+1e-8):raise ValueError('Região OCR fora da imagem.')
                    with Image.open(io.BytesIO(raw)) as picture:
                        step['desktop_ocr_layout']={'width':max(1,round(region['width']*picture.width)),'height':max(1,round(region['height']*picture.height)),'offsetX':round((region['x']+region['width']/2-.5)*picture.width),'offsetY':round((region['y']+region['height']/2-.5)*picture.height)}
            else:step.update(image={'data_url':data},confidence=.8)
            for key in ('offset_x','offset_y'):
                value=event.get(key,0)
                if not isinstance(value,(int,float)) or not -1200<=value<=1200:raise ValueError('Posição do clique inválida.')
                step[key]=round(value)
            steps.append(step)
            if kind=='desktop_text':
                value=event.get('value')
                if not isinstance(value,str) or not value.strip() or len(value)>400:raise ValueError('Informe o texto ou variável para preencher o campo.')
                steps.append(dict(type='focused_text',text=value,clear_before=True,title='Preencher '+label))
        elif kind in ('click','input'):
            selector=event.get('selector')
            if not isinstance(selector,str) or not selector or len(selector)>500 or '<' in selector or re.search(r'[\x00-\x1f]',selector):raise ValueError('Seletor capturado inválido.')
            steps.append(dict(type='element_action',selector=dict(method='css',value=selector),action=dict(type='clicar'),clicks=1,timeout_ms=8000,title=label))
            if kind=='input':
                value=event.get('value')
                if not isinstance(value,str) or not value.strip() or len(value)>400:raise ValueError(f'Informe o texto ou variável do campo {label}.')
                steps.append(dict(type='focused_text',text=value,clear_before=True,title='Preencher '+label))
        else:raise ValueError('Tipo de ação não suportado nesta demonstração.')
        for step in steps[first_step:]:step['demonstration_description']=str(event.get('description') or '')[:1000]
    return dict(schema='flowdetect_chrome_automation',version=3,automation=dict(nome='Demonstração Chrome'),steps=steps)

def section_context(helper,payload):
    context=helper.contexto_chatgpt(payload)
    paths=payload.get('map_paths',[]);sections=[]
    sequences=list(dict.fromkeys([helper.normalizar_nome_sequencia(payload.get('sequencia_inicial'))]+[helper.normalizar_nome_sequencia(e.get('sequencia')) for e in payload.get('eventos',[])]+[seq for path in paths for seq in path.get('sequences',[])]))
    for sequence in sequences:
        path=next((p for p in paths if sequence in p.get('sequences',[])),{})
        blocks=[dict(order=e.get('ordem'),type=e.get('tipo'),title=str((e.get('detalhes') or {}).get('nome') or (e.get('detalhes') or {}).get('chatgpt_title') or e.get('texto') or e.get('tipo'))[:80]) for e in payload.get('eventos',[]) if helper.normalizar_nome_sequencia(e.get('sequencia'))==sequence]
        sections.append(dict(id=sequence,name=path.get('name') or sequence,page=str(path.get('page_id') or '1'),engine=path.get('engine') or 'desktop',blocks=blocks))
    return dict(revision=context['revision'],sections=sections)


def import_demo(helper,payload,request):
    expected=request.get('automation_id')
    if expected and helper.obter_automacao_ativa_id()!=expected:raise ValueError('Reabra a automação vinculada à demonstração.')
    identifier=request.get('session_id')
    if not isinstance(identifier,str) or not re.fullmatch(r'[a-zA-Z0-9-]{20,80}',identifier):raise ValueError('Demonstração sem identificação válida.')
    previous=next((item for item in payload.get('map_paths',[]) if item.get('demonstration_id')==identifier),None)
    if previous or any(e.get('demonstration_id')==identifier for e in payload.get('eventos',[])):return dict(imported=True,already_imported=True,**section_context(helper,payload),message='Esta demonstração já está no mapa.')
    if request.get('revision')!=helper.contexto_chatgpt(payload)['revision']:raise ValueError('O mapa mudou. Clique em Atualizar destino na extensão e revise antes de enviar.')
    engine='desktop' if request.get('engine')=='desktop' else 'chrome'
    if engine=='chrome' and any(event.get('kind') in ('desktop_click','desktop_text','desktop_validation') for event in request.get('events',[]) if isinstance(event,dict)):raise ValueError('Etapas desktop exigem uma seção desktop.')
    target=request.get('target_section')
    if target is not None and target!='__new__' and target not in {s['id'] for s in section_context(helper,payload)['sections']}:raise ValueError('A seção escolhida não existe mais. Atualize o destino e escolha novamente.')
    chrome=project(request.get('events'));draft=copy.deepcopy(payload)
    with tempfile.TemporaryDirectory(prefix='itsflow_demo_') as folder:
        origin=helper.converter_projeto_chrome_importado(chrome,Path(folder))
        for event,step in zip(origin.get('eventos',[]),chrome['steps']):
            if step.get('title'):event.setdefault('detalhes',{})['nome']=step['title']
            if step.get('demonstration_description'):event.setdefault('detalhes',{})['demonstration_description']=step['demonstration_description']
            if engine=='desktop' and step.get('desktop_ocr_layout'):
                layout=step['desktop_ocr_layout'];details=event.setdefault('detalhes',{})
                # Per-target rules take precedence over the block's click setting.
                # Persist both the action and its continuation explicitly.
                layout.update(texto=step.get('text',''),action='clicar' if step.get('click') else 'continuar',
                              clicks=step.get('clicks',1),failureAction=(step.get('on_failure') or {}).get('action','parar'))
                details['ocr_target_layouts']=[layout]
                details['leitura_relativa']={'ativo':True,'lado':'livre','largura':layout['width'],'altura':layout['height'],'offset_x':layout['offsetX'],'offset_y':layout['offsetY']}
        section=helper.mesclar_caminho_mapa(draft,origin,'Demonstração Desktop' if engine=='desktop' else 'Demonstração Chrome','principal',Path(folder));section.update(engine=engine,page_id='1',demonstration_id=identifier)
        imported=draft['eventos'][len(payload.get('eventos',[])):]
        for event in imported:event['demonstration_id']=identifier
        if target and target!='__new__':
            entry=section['entry_sequence']
            for event in imported:
                if event.get('sequencia')==entry:event['sequencia']=target
            draft['map_paths'].remove(section)
            # Converted demonstration steps are linear; no routing of existing blocks is changed.
            draft.get('configuracoes_sequencia',{}).pop(entry,None)
        if expected and helper.obter_automacao_ativa_id()!=expected:raise ValueError('A automação ativa mudou. Reabra o destino antes de enviar.')
        helper.normalizar_configuracoes_sequencia(draft)
        helper.salvar_e_retornar(draft)
    return dict(imported=True,**section_context(helper,draft),message=f"Demonstração adicionada ao mapa: {len(chrome['steps'])} blocos. Revise os alvos antes de executar.")
