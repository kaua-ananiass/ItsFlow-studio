"""Headless desktop recorder. The companion interface is a Studio WebView.

Only JSON travels over stdin/stdout. No account credentials or network access.
Tk is used solely by the existing explicit screenshot-region selector.
"""
import base64
import importlib.util
import io
import json
import queue
import re
import sys
import threading
import time
import uuid
from pathlib import Path


def encode_image(image):
    image=image.copy();image.thumbnail((1200,800))
    stream=io.BytesIO();image.save(stream,format='PNG')
    if len(stream.getvalue())>290000:
        stream=io.BytesIO();image.convert('RGB').save(stream,format='JPEG',quality=80);mime='jpeg'
    else:mime='png'
    if len(stream.getvalue())>300000:raise ValueError('Selecione uma área menor.')
    return {'data_url':f'data:image/{mime};base64,'+base64.b64encode(stream.getvalue()).decode()}


def save_draft(path,state):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    temporary=path.with_suffix('.tmp');temporary.write_text(json.dumps(state,ensure_ascii=False),encoding='utf-8');temporary.replace(path)


class Draft:
    def __init__(self,config):
        self.path=Path(config['session_path'])
        self.state={'id':str(uuid.uuid4()),'automation':config['automation'],'revision':config['revision'],
                    'events':[],'messages':[],'pending':None,'imported':False,'sections':config.get('sections',[]),'target_section':None}
        if self.path.is_file():
            saved=json.loads(self.path.read_text(encoding='utf-8'))
            if saved.get('automation',{}).get('id')==config['automation']['id'] and not saved.get('imported'):self.state=saved
        self.state['sections']=config.get('sections',self.state.get('sections',[]))
        self.state.setdefault('target_section',None)
        self.save()
    def save(self):save_draft(self.path,self.state)
    def append(self,event):
        if self.state['pending']:raise ValueError('Explique a etapa atual primeiro.')
        if len(self.state['events'])>=50:raise ValueError('Envie estas 50 etapas ao mapa antes de continuar.')
        event=dict(event,id=str(uuid.uuid4()));self.state['events'].append(event);self.state['pending']=event['id'];self.save();return event
    def current(self):return next((e for e in self.state['events'] if e['id']==self.state['pending']),None)
    def explain(self,text):
        event=self.current()
        if not event or not text.strip():raise ValueError('Descreva o que você fez nesta etapa.')
        event['description']=text.strip()[:1000];self.save()
    def validate_current(self):
        event=self.current()
        if event and not event.get('description'):raise ValueError('Explique a etapa antes de continuar.')
        if event and event.get('kind')=='desktop_text' and not str(event.get('value') or '').strip():raise ValueError('Informe o texto ou {{VARIAVEL}} que será escrito no campo antes de continuar.')
        if event and event.get('requires_confirmation') and not event.get('confirmed'):raise ValueError('Confirme o bloco na prévia antes de selecionar outra área.')
    def next(self):
        self.validate_current()
        self.state['pending']=None;self.save()
    def restart_after_import(self,revision,message):
        previous=self.state
        self.state={'id':str(uuid.uuid4()),'automation':previous['automation'],'revision':revision,
                    'events':[],'messages':[{'role':'assistant','content':message}],
                    'pending':None,'imported':False,'sections':previous.get('sections',[]),'target_section':previous.get('target_section'),
                    'last_saved':{'id':previous['id'],'count':len(previous['events'])}}
        self.save()


class Recorder:
    def __init__(self,config,emit):
        self.config=config;self.draft=Draft(config);self.emit=emit;self.open=False;self.armed=False;self.busy=False;self.capturing=False
        self.error='';self.status='Uma ação por vez';self.request_id=None;self.operation=None
        self.queue=queue.Queue();self.stop=threading.Event()
        if not self.draft.state['messages']:self.message('assistant','Selecione a área de um botão, campo ou mensagem. Vamos escolher sua finalidade e construir o bloco sem acionar o aplicativo.')
    def message(self,role,text):
        self.draft.state['messages']=(self.draft.state['messages']+[{'role':role,'content':str(text)}])[-20:];self.draft.save()
    def snapshot(self):return {**self.draft.state,'open':self.open,'armed':self.armed,'busy':self.busy,'capturing':self.capturing,'error':self.error,'status':self.status}
    def publish(self):self.emit({'type':'state','state':self.snapshot()})
    def complete_import(self,revision):
        if not isinstance(revision,str) or not revision:raise ValueError('Não foi possível atualizar o destino. Tente novamente.')
        self.draft.restart_after_import(revision,'Blocos salvos no Studio. Selecione a próxima área para continuar.')
        self.open=False;self.armed=False;self.status='Pronto para a próxima área';self.error=''
    def request(self,operation,prompt=''):
        if self.busy:raise ValueError('Aguarde a resposta atual.')
        self.busy=True;self.error='';self.operation=operation;self.request_id=str(uuid.uuid4());self.status='Pensando na sua etapa…' if operation=='chat' else 'Salvando no mapa…'
        state=self.draft.state;current=self.draft.current()
        summary=[{'id':e['id'],'kind':e['kind'],'label':e.get('label','Etapa'),'description':e.get('description',''),'url':'desktop://local','text':e.get('text',''),'source':e.get('source','selection'),'builder_stage':e.get('builder_stage',0),'recognition':e.get('recognition','image'),'clicks':e.get('clicks',1),'on_success':e.get('on_success','continuar'),'on_failure':e.get('on_failure','parar')} for e in state['events']]
        history=state['messages'][:-1] if state['messages'] and state['messages'][-1]['role']=='user' and state['messages'][-1]['content']==prompt else state['messages']
        packet={'type':'request','request_id':self.request_id,'operation':operation,'automation_id':state['automation']['id'],
                'engine':'desktop','target_section':state.get('target_section'),'prompt':prompt,'history':history[-8:],'events':summary if operation=='chat' else state['events'],
                'image':current.get('image',{}).get('data_url') if operation=='chat' and current else None,
                'session_id':state['id'],'revision':state['revision']}
        if len(json.dumps(packet).encode('utf-8'))>4*1024*1024:self.busy=False;raise ValueError('O rascunho ficou grande. Divida a demonstração.')
        self.publish();self.emit(packet)
    def captured(self,event):
        self.capturing=False;self.armed=False;self.open=True;self.error='';self.draft.append(event);self.status='Captura pronta para configurar'
        self.emit({'type':'captured'})
        self.message('assistant','Área capturada. Escolha a ação abaixo e configure seu bloco. Se tiver uma dúvida, envie uma pergunta no chat.')
        self.publish()
    def configure(self,packet):
        current=self.draft.current()
        if not current or self.draft.state['imported']:raise ValueError('Selecione uma área antes de configurar.')
        update=dict(current);kind=packet.get('kind',current['kind'])
        if kind not in ('desktop_click','desktop_text','observe','desktop_validation'):raise ValueError('Tipo de bloco inválido.')
        update['kind']=kind
        if kind!=current['kind']:
            update['on_success']='parar' if kind=='desktop_validation' else 'continuar'
            update['on_failure']='continuar' if kind=='desktop_validation' else 'parar'
        for name in ('on_success','on_failure'):
            action=packet.get(name,update.get(name,'continuar' if name=='on_success' else 'parar'))
            if action not in ('continuar','parar'):raise ValueError('Escolha continuar ou parar para cada resultado.')
            update[name]=action
        clicks=packet.get('clicks',update.get('clicks',1))
        if type(clicks)!=int or clicks not in (1,2):raise ValueError('Escolha 1 ou 2 cliques.')
        update['clicks']=clicks
        for name,limit in (('label',100),('description',1000),('value',400),('text',500)):
            if name in packet:update[name]=str(packet[name])[:limit]
        if 'builder_stage' in packet:
            if type(packet['builder_stage'])!=int or not 0<=packet['builder_stage']<=4:raise ValueError('Etapa de configuração inválida.')
            update['builder_stage']=packet['builder_stage']
        if 'recognition' in packet:
            if packet['recognition'] not in ('image','ocr'):raise ValueError('Reconhecimento inválido.')
            update['recognition']=packet['recognition']
        if 'ocr_region' in packet:
            region=packet['ocr_region']
            if not isinstance(region,dict) or any(type(region.get(k)) not in (int,float) for k in ('x','y','width','height')):raise ValueError('Região OCR inválida.')
            if not (0<=region['x']<1 and 0<=region['y']<1 and 0<region['width']<=1-region['x']+1e-8 and 0<region['height']<=1-region['y']+1e-8):raise ValueError('Região OCR fora da imagem.')
            update['ocr_region']={k:region[k] for k in ('x','y','width','height')}
        for name in ('anchor_x','anchor_y'):
            if name in packet:
                coordinate=packet[name]
                if type(coordinate) not in (float,int) or not 0<=coordinate<=1:raise ValueError('Ponto de clique fora da imagem.')
                update[name]=coordinate
        if 'anchor_x' in update or 'anchor_y' in update:
            from PIL import Image
            with Image.open(io.BytesIO(base64.b64decode(update['image']['data_url'].split(',',1)[1]))) as picture:
                update['offset_x']=round((update.get('anchor_x',.5)-.5)*picture.width)
                update['offset_y']=round((update.get('anchor_y',.5)-.5)*picture.height)
        changed=any(update.get(key)!=current.get(key) for key in update if key not in ('confirmed','builder_stage'))
        update['confirmed']=False if changed else current.get('confirmed',False);self.error=''
        self.draft.state['events'][self.draft.state['events'].index(current)]=update;self.draft.save()
    def command(self,packet):
        if packet.get('request_id'):
            if packet['request_id']!=self.request_id:return
            self.busy=False;self.request_id=None
            if packet.get('error'):self.error=str(packet['error']);self.status='Seu rascunho está salvo'
            else:
                response=packet.get('result',{})
                if self.operation=='status':
                    if response.get('automation',{}).get('id')!=self.draft.state['automation']['id']:raise ValueError('Reabra a automação desta demonstração no Studio.')
                    self.draft.state['sections']=response.get('sections',[]);self.draft.state['revision']=response['revision'];self.status='Destino atualizado'
                    if self.draft.state.get('imported'):self.complete_import(response['revision'])
                elif response.get('imported'):
                    # Keep the saved session id until the next revision is known.
                    # A status retry is safe even if import succeeded but its reply was interrupted.
                    self.draft.state['imported']=True;self.draft.save()
                    revision=response.get('revision')
                    if not revision:
                        self.request('status');return
                    self.draft.state['sections']=response.get('sections',[]);self.complete_import(revision)
                else:
                    answer=response.get('message','Qual resultado você espera desta etapa?');current=self.draft.current()
                    suggestions=re.findall(r'\[\[sugerir:(clique1|clique2|texto|reconhecer|validacao)\]\]',answer)
                    if current and suggestions:current['suggestion']=suggestions[0]
                    self.message('assistant',re.sub(r'\[\[sugerir:[^\]]*\]\]','',answer).strip());self.status='Escolha como o bloco deve funcionar'
            self.draft.save();self.publish();return
        op=packet.get('op')
        if op=='close':self.armed=False;self.draft.save();self.stop.set();self.emit({'type':'closed'});return
        if op=='show' or op=='open':self.open=True;self.armed=False;self.publish();return
        if op=='collapse':self.open=False;self.armed=False;self.publish();return
        if self.busy:raise ValueError('Aguarde a resposta atual.')
        if op=='arm':
            return self.command({**packet,'op':'capture'})
        elif op=='explain':
            text=str(packet.get('text','')).strip()[:4000]
            if not text:return
            self.message('user',text);self.request('chat',text);return
        elif op=='retry':
            if self.draft.state.get('imported'):self.request('status');return
            question=next((m['content'] for m in reversed(self.draft.state['messages']) if m['role']=='user'),None)
            if question:self.request('chat',question);return
            self.error='';self.status='Configure o bloco ou envie uma pergunta no chat'
        elif op=='edit':self.configure(packet)
        elif op=='confirm':
            self.configure(packet);current=self.draft.current()
            if not current.get('description','').strip():raise ValueError('Descreva a finalidade do bloco no campo ou no chat.')
            if current['kind']=='desktop_text' and not current.get('value','').strip():raise ValueError('Informe o texto ou variável que será digitado.')
            if current.get('recognition')=='ocr' and not current.get('text','').strip():raise ValueError('Informe o texto esperado no reconhecimento OCR.')
            current['confirmed']=True;self.draft.save();self.error='';self.status='Bloco confirmado no rascunho'
        elif op=='undo':
            if self.draft.state['imported']:raise ValueError('Esta demonstração já está no mapa.')
            if self.draft.state['events']:self.draft.state['events'].pop();self.draft.state['pending']=None;self.draft.save()
        elif op=='map_sections':
            self.draft.state['sections']=packet.get('sections',[])
            self.draft.state['revision']=packet['revision']
            if self.draft.state.get('target_section') not in {s['id'] for s in self.draft.state['sections']}|{'__new__'}:self.draft.state['target_section']=None
            self.error='';self.draft.save()
        elif op=='destination':
            target=packet.get('target_section')
            if target!='__new__' and target not in {s['id'] for s in self.draft.state.get('sections',[])}:raise ValueError('Escolha uma se\u00e7\u00e3o dispon\u00edvel.')
            self.draft.state['target_section']=target;self.error='';self.draft.save()
        elif op=='import':
            self.draft.validate_current()
            if not self.draft.state['events']:raise ValueError('Selecione e configure uma área antes de enviar ao mapa.')
            if self.config.get('sections') is not None and not self.draft.state.get('target_section'):raise ValueError('Escolha a se\u00e7\u00e3o de destino antes de enviar.')
            self.request('import');return
        elif op=='refresh':self.request('status');return
        elif op=='capture':
            if self.draft.state['imported']:raise ValueError('Demonstração já enviada. Feche e abra para iniciar outra.')
            self.draft.next();self.armed=False;self.open=False;self.capturing=True;self.error='';self.status='Capturando área…';self.publish()
            # Native overlays are excluded from screen capture. Keep them visible
            # while allowing the expanded panel to fold into the capture notch.
            time.sleep(.12)
            try:
                ui=capture_module();limits=ui.obter_limites_tela_virtual()
                from PIL import ImageGrab
                image=ImageGrab.grab(all_screens=True);area=ui.selecionar_area_da_tela(image,limits,on_ready=lambda:self.emit({'type':'capture-ready'}))
                self.capturing=False
                if area:self.captured({'kind':'observe','label':'Novo reconhecimento','image':encode_image(ui.recortar_imagem_base(image,area,limits)),
                    'offset_x':0,'offset_y':0,'anchor_x':.5,'anchor_y':.5,'clicks':1,'requires_confirmation':True,'confirmed':False,'source':'selection'})
                else:self.open=False;self.status='Captura cancelada';self.publish()
            except Exception:self.capturing=False;self.open=True;raise
            return
        self.publish()


def capture_module():
    spec=importlib.util.spec_from_file_location('itsflow_capture_ui',Path(__file__).resolve().with_name('capturar_imagem_tela.py'))
    module=importlib.util.module_from_spec(spec);sys.modules[spec.name]=module;spec.loader.exec_module(module);return module


def run(config):
    # Selection is explicit: no global click or keyboard recording is installed.
    ui=capture_module();ui.configurar_dpi_windows()
    def emit(packet):print(json.dumps(packet,ensure_ascii=False),flush=True)
    recorder=Recorder(config,emit)
    def read():
        for line in sys.stdin:
            try:recorder.queue.put(json.loads(line))
            except Exception:continue
        recorder.queue.put({'op':'close'})
    threading.Thread(target=read,daemon=True).start();recorder.publish()
    while not recorder.stop.is_set():
        try:recorder.command(recorder.queue.get(timeout=.1))
        except queue.Empty:pass
        except Exception as error:recorder.error=str(error);recorder.open=True;recorder.publish()


if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8');sys.stdin.reconfigure(encoding='utf-8');run(json.loads(sys.stdin.readline()))
