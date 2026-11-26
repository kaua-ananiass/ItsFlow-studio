"""Validated demonstration -> editable Chrome section; never executes actions."""
import base64,copy,io,re,tempfile
import importlib.util
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

def insertion_routes(helper,payload):
    """Project saved routing, including per-OCR overrides, without changing it."""
    events=payload.get('eventos',[]);by_order={int(e['ordem']):e for e in events};groups={}
    for event in events:groups.setdefault(helper.normalizar_nome_sequencia(event.get('sequencia')),[]).append(event)
    edges=[];free=set();labels={}
    def number(value):
        try:return int(value)
        except (TypeError,ValueError):return 0
    for sequence,items in groups.items():
        for index,event in enumerate(items):
            order=int(event['ordem']);details=event.get('detalhes') or {};kind=event.get('tipo')
            following=int(items[index+1]['ordem']) if index+1<len(items) else None
            def route(action='continuar',block='',destination='',label='Continuar',success=True):
                action=str(action or 'continuar').strip().lower();target=None
                if action=='continuar':
                    target=following
                    if target is None and success:free.add(order)
                elif action=='ir_para_bloco':target=number(block)
                elif action=='ir_para_sequencia':
                    group=groups.get(helper.normalizar_nome_sequencia(destination),[]) if destination else []
                    target=int(group[0]['ordem']) if group else None
                labels.setdefault(order,[]).append(label+(f' → bloco {target}' if target is not None else f' ({action})' if action!='continuar' else ''))
                if target in by_order:edges.append(dict(source=order,target=target,label=label))
            normal=lambda label='Ao concluir':route(details.get('ao_sucesso','continuar'),details.get('bloco_sucesso'),details.get('sequencia_sucesso'),label)
            layouts=[t for t in details.get('ocr_target_layouts',[]) if isinstance(t,dict)]
            individual=kind in ('clicar_imagem','procurar_texto_ocr') and any('action' in t or 'acao' in t for t in layouts)
            if individual:
                for i,target in enumerate(layouts):
                    action=str(target.get('action',target.get('acao','continuar')) or 'continuar').lower()
                    if action in ('confirmar_ir_para_bloco','clicar_ir_para_bloco','ir_para_bloco','bloco','navegar','clicar_e_ir_para_bloco','confirmar_e_ir_para_bloco','click_and_jump','click_goto','confirm_and_jump','confirm_goto'):
                        route('ir_para_bloco',target.get('block',target.get('bloco')),label=f'OCR {i+1}')
                    else:normal(f'OCR {i+1}')
                    failure=str(target.get('failureAction',target.get('failure_action',target.get('acao_falha','continuar'))) or 'continuar').lower()
                    if failure in ('ir_para_bloco','bloco','navegar','goto','jump'):
                        route('ir_para_bloco',target.get('failureBlock',target.get('failure_block',target.get('bloco_falha'))),label=f'Falha OCR {i+1}',success=False)
                    if i==len(layouts)-1 and failure=='continuar':route(label=f'Falha OCR {i+1}',success=False)
                    if failure in ('parar','stop','interromper','ir_para_bloco','bloco','navegar','goto','jump'):break
            else:
                normal()
                if kind in ('clicar_imagem','procurar_texto_ocr'):
                    route(details.get('ao_nao_encontrar','parar'),details.get('bloco_nao_encontrar'),details.get('sequencia_nao_encontrar'),'Não encontrado',success=False)
    result={}
    for sequence,items in groups.items():
        seen=set();todo=[int(items[0]['ordem'])]
        adjacency={}
        for edge in edges:adjacency.setdefault(edge['source'],[]).append(edge['target'])
        while todo:
            order=todo.pop()
            if order in seen:continue
            seen.add(order);todo.extend(adjacency.get(order,[]))
        last=int(items[-1]['ordem']);orphans=[int(e['ordem']) for e in items if int(e['ordem']) not in seen]
        allowed=last in seen and last in free
        if last not in seen:
            reason=f'O bloco {last} já está sem caminho de entrada nesta seção. O fluxo desvia antes dele; um novo bloco também ficaria desconectado. Escolha outra seção com continuação livre ou ajuste as conexões no mapa.'
        elif last not in free:
            reason=f'O bloco {last} já possui uma saída definida ({"; ".join(labels.get(last,[]))}). Não há continuação livre para o novo bloco. Escolha outra seção ou ajuste as conexões no mapa.'
        else:reason=f'Entrará depois do bloco {last}, pela continuação livre.'
        result[sequence]=dict(allowed=allowed,reason=reason,after_order=last,orphan_orders=orphans,
                              edges=[edge for edge in edges if edge['source'] in {int(e['ordem']) for e in items}])
    return result


def section_context(helper,payload):
    context=helper.contexto_chatgpt(payload)
    paths=payload.get('map_paths',[]);sections=[]
    sequences=list(dict.fromkeys([helper.normalizar_nome_sequencia(payload.get('sequencia_inicial'))]+[helper.normalizar_nome_sequencia(e.get('sequencia')) for e in payload.get('eventos',[])]+[seq for path in paths for seq in path.get('sequences',[])]))
    insertion=insertion_routes(helper,payload)
    for sequence in sequences:
        path=next((p for p in paths if sequence in p.get('sequences',[])),{})
        blocks=[dict(order=e.get('ordem'),type=e.get('tipo'),title=str((e.get('detalhes') or {}).get('nome') or (e.get('detalhes') or {}).get('chatgpt_title') or e.get('texto') or e.get('tipo'))[:80]) for e in payload.get('eventos',[]) if helper.normalizar_nome_sequencia(e.get('sequencia'))==sequence]
        sections.append(dict(id=sequence,name=path.get('name') or sequence,page=str(path.get('page_id') or '1'),engine=path.get('engine') or 'desktop',blocks=blocks,
                             insertion=insertion.get(sequence,dict(allowed=True,reason='Será o primeiro bloco da seção.',orphan_orders=[],edges=[]))))
    return dict(revision=context['revision'],sections=sections)

def test_catalog(helper,payload,request):
    """Saved blocks only; diagnostics never dispatch a block's execution action."""
    expected=request.get('automation_id')
    if not expected or helper.obter_automacao_ativa_id()!=expected:raise ValueError('Reabra a automação vinculada ao assistente.')
    context=section_context(helper,payload)
    if request.get('revision') and request['revision']!=context['revision']:raise ValueError('O mapa mudou. Atualize os blocos antes de testar.')
    for section in context['sections']:
        section['blocks']=[]
        for event in payload.get('eventos',[]):
            if helper.normalizar_nome_sequencia(event.get('sequencia'))!=section['id']:continue
            details=event.get('detalhes') or {};card=helper.card_do_evento(event)
            kind=event.get('tipo');recognition=kind in ('clicar_imagem','procurar_texto_ocr')
            text=str(details.get('texto_ocr_busca') or details.get('texto_ocr_esperado') or (details.get('texto') if kind=='procurar_texto_ocr' else '') or '')
            layouts=details.get('ocr_target_layouts') or []
            targets='\n'.join(str(t.get('texto') or t.get('text') or t.get('ocrText') or '').strip() for t in layouts if isinstance(t,dict)).strip()
            if details.get('fonte_ocr')!='elemento':text=targets or text
            image=details.get('imagem') or details.get('imagem_ocr') or ''
            selector=text if details.get('fonte_ocr')=='elemento' else ''
            block=dict(order=card['order'],id=card['id'],type=kind,title=details.get('nome') or card['title'],image=image,
                       text=event.get('texto','') if kind=='texto_livre' else text,keys=card['keys'],
                       test_screen=recognition and bool(image or text) and not selector,
                       test_chrome=recognition and bool(text),sheet=details.get('aba',''),column=details.get('coluna',''),
                       selector=selector,texts=[] if selector else [t.strip() for t in text.splitlines() if t.strip()])
            if request.get('order')==card['order']:
                if not recognition:raise ValueError('Este bloco oferece prévia. O teste isolado está disponível para reconhecimentos.')
                if request.get('block_id')!=card['id']:raise ValueError('O bloco mudou. Atualize a lista antes de testar.')
                relative=copy.deepcopy(details.get('leitura_relativa') or {})
                if 'ativo' in relative:relative['ativa']=relative.pop('ativo')
                relative['ocr_target_layouts']=layouts
                # Recognition probes never persist extracted variables.
                relative['salvar_em']=''
                mode=details.get('modo_reconhecimento') or ('texto_ocr' if kind=='procurar_texto_ocr' else 'imagem')
                # A saved reference is part of recognition, not merely a preview.
                return dict(revision=context['revision'],block=block,worker=dict(imagem=image,tela_inteira=True,timeout=min(10,max(.1,float(details.get('timeout',8)))),
                    confianca=details.get('confianca',.8),perfil_busca=details.get('perfil_busca','balanced'),janela_alvo='',
                    modo_reconhecimento=mode,
                    texto_ocr_busca='' if selector else text,texto_ocr_esperado='' if selector else text,
                    leitura_relativa=relative,modo_area_busca='target_window',area_personalizada={},bloco_id=str(card['order'])))
            section['blocks'].append(block)
    if request.get('order') is not None:raise ValueError('O bloco não existe mais. Atualize a lista.')
    return context


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
    if target and target!='__new__':
        destination=next(s for s in section_context(helper,payload)['sections'] if s['id']==target)
        if not destination['insertion']['allowed']:raise ValueError(destination['insertion']['reason'])
    # Embedded Python deliberately omits the script directory from sys.path.
    # Resolve this trusted sibling explicitly, just like gerenciar_roteiro loads us.
    spec=importlib.util.spec_from_file_location('itsflow_desktop_blocks',Path(__file__).resolve().with_name('desktop_assistant.py'))
    if spec is None or spec.loader is None:raise ValueError('Não foi possível carregar o criador de blocos do assistente.')
    builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
    MANUAL_KINDS,compile_manual=builder.MANUAL_KINDS,builder.compile_manual
    events=request.get('events')
    if not isinstance(events,list) or not 1<=len(events)<=50:raise ValueError('Configure de 1 a 50 etapas.')
    manual=any(event.get('kind') in MANUAL_KINDS for event in events if isinstance(event,dict))
    if manual and (engine!='desktop' or any(not isinstance(e,dict) or e.get('kind') not in MANUAL_KINDS for e in events)):raise ValueError('Envie este bloco separadamente das capturas.')
    chrome={'steps':[]} if manual else project(events);draft=copy.deepcopy(payload)
    with tempfile.TemporaryDirectory(prefix='itsflow_demo_') as folder:
        origin=compile_manual(helper,events) if manual else helper.converter_projeto_chrome_importado(chrome,Path(folder))
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
        section=helper.mesclar_caminho_mapa(draft,origin,'Demonstração Desktop' if engine=='desktop' else 'Demonstração Chrome','principal',None if manual else Path(folder));section.update(engine=engine,page_id='1',demonstration_id=identifier)
        imported=draft['eventos'][len(payload.get('eventos',[])):]
        for event in imported:event['demonstration_id']=identifier
        if target and target!='__new__':
            entry=section['entry_sequence']
            for event in imported:
                if event.get('sequencia')==entry:event['sequencia']=target
            draft['map_paths'].remove(section)
            # Converted demonstration steps are linear; no routing of existing blocks is changed.
            draft.get('configuracoes_sequencia',{}).pop(entry,None)
        if manual and any(e.get('kind')=='manual_sheet' and e.get('loop') for e in events):
            sequence=target if target and target!='__new__' else section['entry_sequence']
            draft.setdefault('configuracoes_sequencia',{})[sequence]={'modo_execucao':'loop_planilha','sequencia_apos_loop':''}
        if expected and helper.obter_automacao_ativa_id()!=expected:raise ValueError('A automação ativa mudou. Reabra o destino antes de enviar.')
        helper.normalizar_configuracoes_sequencia(draft)
        helper.salvar_e_retornar(draft)
    return dict(imported=True,**section_context(helper,draft),message=f"Adicionado ao mapa: {len(imported)} bloco(s). Revise antes de executar.")
