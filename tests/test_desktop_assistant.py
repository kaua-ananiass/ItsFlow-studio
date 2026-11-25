import base64
import copy
import io
import tempfile
import unittest
from types import SimpleNamespace
from pathlib import Path
from unittest.mock import patch
from PIL import Image

import desktop_assistant as assistant
import chrome_demonstration as demo
import gerenciar_roteiro as helper


class DesktopAssistantTests(unittest.TestCase):
    def config(self,folder):return {'session_path':str(Path(folder)/'session.json'),'automation':{'id':'a1','name':'Desktop e Chrome'},'revision':'r1'}

    def test_capture_and_visual_builder_do_not_request_ai(self):
        with tempfile.TemporaryDirectory() as folder:
            packets=[];recorder=assistant.Recorder(self.config(folder),packets.append)
            image=assistant.encode_image(Image.new('RGB',(100,60),'white'))
            recorder.error='subscription_sharing_usage_limit_exceeded'
            recorder.captured({'kind':'observe','image':image,'requires_confirmation':True})
            self.assertEqual(recorder.error,'');self.assertFalse(recorder.busy)
            recorder.command({'op':'retry'})
            recorder.command({'op':'edit','kind':'desktop_click','description':'Salvar cadastro','builder_stage':2})
            recorder.command({'op':'confirm','recognition':'ocr','text':'Salvar','builder_stage':3})
            recorder.command({'op':'destination','target_section':'__new__'})
            recorder.command({'op':'import'})
            requests=[p for p in packets if p.get('type')=='request']
            self.assertEqual([p['operation'] for p in requests],['import'])
            self.assertEqual(requests[0]['target_section'],'__new__')

    def test_only_user_question_requests_ai_and_limit_does_not_block_configuration(self):
        with tempfile.TemporaryDirectory() as folder:
            packets=[];recorder=assistant.Recorder(self.config(folder),packets.append)
            image=assistant.encode_image(Image.new('RGB',(100,60),'white'))
            recorder.captured({'kind':'observe','image':image,'requires_confirmation':True})
            recorder.command({'op':'explain','text':'Como configuro a validação?'})
            request=packets[-1]
            self.assertEqual(request['operation'],'chat')
            self.assertFalse(recorder.draft.current().get('description'))
            recorder.command({'request_id':request['request_id'],'error':'subscription_sharing_usage_limit_exceeded'})
            self.assertFalse(recorder.busy)
            recorder.command({'op':'edit'})
            self.assertEqual(recorder.error,'')
            recorder.command({'op':'confirm','description':'Conferir mensagem','builder_stage':3})
            recorder.command({'op':'destination','target_section':'__new__'})
            recorder.command({'op':'import'})
            requests=[p for p in packets if p.get('type')=='request']
            self.assertEqual([p['operation'] for p in requests],['chat','import'])

    def test_destination_is_explicit_persisted_and_sent_to_studio(self):
        with tempfile.TemporaryDirectory() as folder:
            config={**self.config(folder),'sections':[{'id':'principal','name':'Principal','page':'1','blocks':[]}]}
            packets=[];recorder=assistant.Recorder(config,packets.append)
            recorder.draft.append({'kind':'observe','description':'Conferir','confirmed':True,'requires_confirmation':True})
            with self.assertRaisesRegex(ValueError,'destino'):recorder.command({'op':'import'})
            with self.assertRaisesRegex(ValueError,'dispon'):recorder.command({'op':'destination','target_section':'inexistente'})
            recorder.command({'op':'destination','target_section':'principal'})
            self.assertEqual(assistant.Draft(config).state['target_section'],'principal')
            recorder.command({'op':'import'})
            self.assertEqual(packets[-1]['target_section'],'principal')
            recorder.command({'request_id':packets[-1]['request_id'],'result':{'imported':True,'revision':'r2','sections':config['sections']}})
            self.assertEqual(recorder.snapshot()['target_section'],'principal')
            self.assertEqual(recorder.snapshot()['sections'],config['sections'])

    def test_map_sections_reloads_existing_draft_and_clears_removed_destination(self):
        with tempfile.TemporaryDirectory() as folder:
            config={**self.config(folder),'sections':[]}
            recorder=assistant.Recorder(config,lambda packet:None)
            recorder.draft.state['target_section']='removed';recorder.draft.save()
            config['sections']=[{'id':'available','name':'Disponível','page':'1','blocks':[]}]
            recorder=assistant.Recorder(config,lambda packet:None)
            self.assertEqual(recorder.snapshot()['sections'],config['sections'])
            recorder.error='Controle do assistente inválido.'
            recorder.command({'op':'map_sections','sections':config['sections'],'revision':'new-map'})
            self.assertEqual(recorder.snapshot()['revision'],'new-map')
            self.assertIsNone(recorder.snapshot()['target_section'])
            self.assertEqual(recorder.error,'')
            recorder.command({'op':'destination','target_section':'available'})
            self.assertEqual(recorder.snapshot()['target_section'],'available')

    def test_successful_import_returns_to_notch_and_can_save_the_next_capture(self):
        with tempfile.TemporaryDirectory() as folder:
            payload={'eventos':[]};helper.normalizar_configuracoes_sequencia(payload)
            config={**self.config(folder),'revision':helper.contexto_chatgpt(payload)['revision']}
            packets=[];recorder=assistant.Recorder(config,packets.append)
            image=assistant.encode_image(Image.new('RGB',(100,60),'white'));saved=[]
            def save(draft):
                helper.normalizar_eventos(draft);helper.normalizar_configuracoes_sequencia(draft)
                saved.append(copy.deepcopy(draft))
            sessions=[]
            with patch.object(helper,'obter_automacao_ativa_id',return_value='a1'),patch.object(helper,'PASTA_IMAGENS',Path(folder)/'images'),patch.object(helper,'DIRETORIO_PLANILHAS',Path(folder)/'sheets'),patch.object(helper,'salvar_e_retornar',side_effect=save):
                for number in range(2):
                    recorder.captured({'kind':'observe','label':f'Etapa {number+1}','image':image,'source':'selection','requires_confirmation':True})
                    recorder.command({'op':'confirm','description':'Conferir mensagem','builder_stage':3})
                    recorder.command({'op':'import'});request=packets[-1];sessions.append(request['session_id'])
                    result=demo.import_demo(helper,payload,request);payload=saved[-1]
                    self.assertEqual(result['revision'],helper.contexto_chatgpt(payload)['revision'])
                    recorder.command({'request_id':request['request_id'],'result':result})
                    snapshot=recorder.snapshot()
                    self.assertFalse(snapshot['open']);self.assertFalse(snapshot['busy']);self.assertFalse(snapshot['imported'])
                    self.assertEqual(snapshot['events'],[]);self.assertIsNone(snapshot['pending'])
                    self.assertNotEqual(snapshot['id'],request['session_id']);self.assertEqual(snapshot['revision'],result['revision'])
                    self.assertEqual(snapshot['last_saved'],{'id':request['session_id'],'count':1})
                    self.assertEqual(assistant.Draft(config).state['id'],snapshot['id'])
                    self.assertEqual(len(payload['eventos']),number+1)
                    duplicate=demo.import_demo(helper,payload,request)
                    self.assertTrue(duplicate['already_imported']);self.assertEqual(duplicate['revision'],snapshot['revision'])
                self.assertNotEqual(sessions[0],sessions[1]);self.assertEqual(len(saved),2)

    def test_failed_import_keeps_editable_step_and_missing_revision_refreshes_before_reset(self):
        with tempfile.TemporaryDirectory() as folder:
            packets=[];recorder=assistant.Recorder(self.config(folder),packets.append)
            recorder.open=True
            event=recorder.draft.append({'kind':'observe','description':'Conferir','confirmed':True,'requires_confirmation':True})
            session=recorder.draft.state['id'];recorder.command({'op':'import'})
            recorder.command({'request_id':packets[-1]['request_id'],'error':'Mapa mudou'})
            self.assertEqual(recorder.draft.current()['id'],event['id']);self.assertTrue(recorder.open)
            self.assertEqual(recorder.draft.state['id'],session);self.assertFalse(recorder.draft.state['imported'])
            recorder.command({'op':'import'});recorder.command({'request_id':packets[-1]['request_id'],'result':{'imported':True}})
            self.assertEqual(packets[-1]['operation'],'status');self.assertEqual(recorder.draft.state['id'],session)
            recorder.command({'request_id':packets[-1]['request_id'],'result':{'automation':{'id':'a1'},'revision':'r2'}})
            self.assertFalse(recorder.open);self.assertFalse(recorder.busy);self.assertFalse(recorder.draft.state['imported'])
            self.assertEqual(recorder.draft.state['revision'],'r2');self.assertNotEqual(recorder.draft.state['id'],session)
            with self.assertRaisesRegex(ValueError,'Selecione'):recorder.command({'op':'import'})

    def test_pending_action_explanation_and_resume_survive_closing(self):
        with tempfile.TemporaryDirectory() as folder:
            config=self.config(folder);draft=assistant.Draft(config)
            first=draft.append({'kind':'desktop_click','label':'Sistema local'})
            with self.assertRaises(ValueError):draft.append({'kind':'desktop_click'})
            with self.assertRaises(ValueError):draft.next()
            draft.explain('Abre o cadastro do cliente')
            reopened=assistant.Draft(config)
            self.assertEqual(reopened.current()['id'],first['id'])
            self.assertEqual(reopened.current()['description'],'Abre o cadastro do cliente')
            reopened.next();second=reopened.append({'kind':'desktop_click','label':'Google Chrome'})
            self.assertNotEqual(second['id'],first['id']);self.assertEqual(len(reopened.state['events']),2)
            foreign=assistant.Draft({**config,'automation':{'id':'a2','name':'Outra'}})
            self.assertEqual(foreign.state['events'],[])

    def test_text_step_needs_explicit_value_before_rearming(self):
        with tempfile.TemporaryDirectory() as folder:
            draft=assistant.Draft(self.config(folder));draft.append({'kind':'desktop_text','label':'Nome'})
            draft.explain('Preencher o cliente da planilha')
            with self.assertRaisesRegex(ValueError,'VARIAVEL'):draft.next()
            draft.current()['value']='{{CLIENTE}}';draft.next();self.assertIsNone(draft.current())

    def test_import_mixed_app_actions_as_visual_desktop_blocks_with_offsets(self):
        payload={'eventos':[{'ordem':1,'sequencia':'principal','tipo':'texto_livre','texto':'Existente','detalhes':{}}]}
        image=assistant.encode_image(Image.new('RGB',(220,110),'white'))
        request={'session_id':'12345678-1234-1234-1234-123456789abc','engine':'desktop',
                 'revision':helper.contexto_chatgpt(payload)['revision'],'events':[
                     {'kind':'desktop_click','label':'Aplicativo Windows','image':image,'offset_x':-21,'offset_y':12,'description':'Abrir cliente'},
                     {'kind':'desktop_text','label':'Google Chrome','image':image,'value':'{{CLIENTE}}'},
                     {'kind':'observe','label':'Conferir mensagem','image':image}]}
        saved=[]
        with tempfile.TemporaryDirectory() as folder, \
             patch.object(helper,'PASTA_IMAGENS',Path(folder)/'images'), \
             patch.object(helper,'DIRETORIO_PLANILHAS',Path(folder)/'sheets'), \
             patch.object(helper,'salvar_e_retornar',side_effect=lambda draft:saved.append(draft)):
            result=demo.import_demo(helper,payload,request)
            self.assertTrue(result['imported']);draft=saved[0]
            self.assertEqual(draft['map_paths'][0]['engine'],'desktop')
            self.assertEqual(len(draft['eventos']),5)
            click=draft['eventos'][1]['detalhes'];self.assertTrue(click['clicar']);self.assertEqual(click['offset_x'],-21)
            self.assertEqual(click['demonstration_description'],'Abrir cliente')
            self.assertTrue(Path(click['imagem']).is_file())
            self.assertEqual(draft['eventos'][3]['texto'],'{{CLIENTE}}')
            self.assertFalse(draft['eventos'][4]['detalhes']['clicar'])
            self.assertEqual(payload['eventos'][0]['texto'],'Existente')
        with self.assertRaises(ValueError):demo.project([{'kind':'desktop_text','image':image,'value':''}])

    def test_capture_dimensions_and_image_encoding(self):
        image=assistant.encode_image(Image.new('RGB',(2400,1600),'white'))
        with Image.open(io.BytesIO(base64.b64decode(image['data_url'].split(',')[1]))) as picture:
            self.assertEqual(picture.size,(1200,800))

    def test_headless_recorder_drives_webview_states_and_reuses_saved_steps(self):
        with tempfile.TemporaryDirectory() as folder:
            packets=[];recorder=assistant.Recorder(self.config(folder),packets.append)
            recorder.command({'op':'collapse'})
            self.assertFalse(recorder.armed);self.assertFalse(recorder.open)
            image=assistant.encode_image(Image.new('RGB',(220,110),'white'))
            recorder.captured({'kind':'desktop_click','label':'Salvar','image':image})
            self.assertFalse(recorder.armed);self.assertTrue(recorder.open);self.assertFalse(recorder.busy)
            self.assertFalse(any(packet.get('type')=='request' for packet in packets))
            recorder.command({'op':'explain','text':'O que este botão faz?'})
            request=packets[-1];self.assertEqual(request['type'],'request');self.assertEqual(request['image'],image['data_url'])
            self.assertTrue(packets[-2]['state']['busy'])
            recorder.command({'request_id':request['request_id'],'result':{'message':'O que este botão faz?'}})
            self.assertFalse(recorder.busy)
            recorder.command({'op':'edit','kind':'desktop_text','value':'{{CLIENTE}}','description':'Escreve o nome do cliente'})
            recorder.command({'op':'explain','text':'Escreve o nome do cliente'})
            request=packets[-1];self.assertNotIn('value',request['events'][-1]);self.assertEqual(request['engine'],'desktop')
            recorder.command({'request_id':request['request_id'],'error':'Sem conexão'})
            self.assertEqual(recorder.draft.current()['description'],'Escreve o nome do cliente')
            recorder.draft.next();recorder.command({'op':'collapse'});self.assertFalse(recorder.armed);self.assertEqual(len(recorder.draft.state['events']),1)
            recorder.command({'op':'open'});self.assertFalse(recorder.armed);self.assertTrue(recorder.open)
            recorder.command({'op':'close'});self.assertTrue(recorder.stop.is_set())
            self.assertEqual(assistant.Draft(self.config(folder)).state['events'][0]['value'],'{{CLIENTE}}')

    def test_selected_block_requires_confirmation_and_suggestion_does_not_apply_itself(self):
        with tempfile.TemporaryDirectory() as folder:
            packets=[];recorder=assistant.Recorder(self.config(folder),packets.append)
            image=assistant.encode_image(Image.new('RGB',(220,110),'white'))
            recorder.captured({'kind':'observe','label':'Região selecionada','image':image,'requires_confirmation':True,'source':'selection'})
            self.assertFalse(any(packet.get('type')=='request' for packet in packets))
            recorder.command({'op':'explain','text':'Pode analisar o campo?'})
            recorder.command({'request_id':packets[-1]['request_id'],'result':{'message':'Parece um campo. Qual a finalidade? [[sugerir:texto]]'}})
            self.assertEqual(recorder.draft.current()['kind'],'observe')
            self.assertEqual(recorder.draft.current()['suggestion'],'texto')
            self.assertNotIn('[[sugerir:',recorder.draft.state['messages'][-1]['content'])
            recorder.configure({'kind':'desktop_click','clicks':2,'description':'Abrir cadastro','anchor_x':.75,'anchor_y':.25})
            with self.assertRaisesRegex(ValueError,'Confirme'):recorder.draft.next()
            current=recorder.draft.current();self.assertEqual(current['offset_x'],55);self.assertEqual(current['offset_y'],-28)
            recorder.command({'op':'confirm','kind':'desktop_click','clicks':2})
            self.assertTrue(recorder.draft.current()['confirmed'])
            recorder.command({'op':'explain','text':'Pode explicar o duplo clique?'})
            self.assertEqual(recorder.draft.current()['description'],'Abrir cadastro')
            recorder.command({'request_id':packets[-1]['request_id'],'result':{'message':'São dois cliques na mesma imagem.'}})
            recorder.draft.next()

    def test_validation_routes_and_actual_import_preserve_no_click_and_double_click(self):
        image=assistant.encode_image(Image.new('RGB',(100,60),'white'))
        steps=demo.project([{'kind':'desktop_click','image':image,'clicks':2},
                            {'kind':'desktop_validation','image':image,'description':'Mensagem de erro'}])['steps']
        self.assertTrue(steps[0]['click']);self.assertEqual(steps[0]['clicks'],2)
        self.assertFalse(steps[1]['click']);self.assertEqual(steps[1]['on_success']['action'],'parar');self.assertEqual(steps[1]['on_failure']['action'],'continuar')
        with tempfile.TemporaryDirectory() as folder:
            payload=helper.converter_projeto_chrome_importado({'schema':'flowdetect_chrome_automation','steps':steps},Path(folder))
            self.assertEqual(payload['eventos'][0]['detalhes']['cliques'],2)
            validation=payload['eventos'][1];self.assertFalse(validation['detalhes']['clicar'])
            from executar_automacao import ExecutorAutomacao
            executor=ExecutorAutomacao.__new__(ExecutorAutomacao)
            with patch.object(executor,'cancelamento_solicitado',return_value=False):
                self.assertEqual(executor.resultado_sucesso_evento(validation)['acao'],'parar')
        with self.assertRaises(ValueError):demo.project([{'kind':'observe','image':image,'requires_confirmation':True,'confirmed':False}])
        for change in ({'clicks':3},{'anchor_x':2},{'on_failure':'execute_script'}):
            with tempfile.TemporaryDirectory() as folder:
                recorder=assistant.Recorder(self.config(folder),lambda p:None);recorder.draft.append({'kind':'observe','image':image})
                with self.assertRaises(ValueError):recorder.configure(change)

    def test_ocr_step_persists_region_and_imports_as_desktop_recognition(self):
        image=assistant.encode_image(Image.new('RGB',(200,100),'white'))
        with tempfile.TemporaryDirectory() as folder:
            recorder=assistant.Recorder(self.config(folder),lambda p:None)
            recorder.draft.append({'kind':'desktop_click','image':image,'source':'selection','requires_confirmation':True})
            recorder.command({'op':'edit','description':'Salvar cadastro','recognition':'ocr','builder_stage':2,'text':''})
            with self.assertRaisesRegex(ValueError,'texto esperado'):recorder.command({'op':'confirm'})
            recorder.command({'op':'confirm','text':'Salvar','clicks':2,'builder_stage':3,'ocr_region':{'x':.1,'y':.2,'width':.6,'height':.5}})
            event=assistant.Draft(self.config(folder)).current()
            self.assertEqual(event['builder_stage'],3);self.assertTrue(event['confirmed'])
            steps=demo.project([event])['steps'];self.assertEqual(steps[0]['action'],'clicar');self.assertEqual(steps[0]['clicks'],2)
            self.assertEqual(steps[0]['desktop_ocr_layout'],{'width':120,'height':50,'offsetX':-20,'offsetY':-5})
            payload={'eventos':[]};saved=[]
            request={'session_id':'12345678-1234-1234-1234-123456789abc','engine':'desktop','events':[event],'revision':helper.contexto_chatgpt(payload)['revision']}
            with patch.object(helper,'PASTA_IMAGENS',Path(folder)/'images'),patch.object(helper,'DIRETORIO_PLANILHAS',Path(folder)/'sheets'),patch.object(helper,'salvar_e_retornar',side_effect=saved.append):
                demo.import_demo(helper,payload,request)
            details=saved[0]['eventos'][0]['detalhes']
            self.assertEqual(details['texto_ocr_busca'],'Salvar');self.assertEqual(details['fonte_ocr'],'legado')
            self.assertEqual(details['leitura_relativa']['largura'],120);self.assertEqual(details['ocr_target_layouts'][0]['offsetX'],-20)
            self.assertTrue(details['clicar']);self.assertEqual(details['acao_ocr'],'clicar')
            for region in ({'x':.8,'y':0,'width':.5,'height':1},{'x':0,'y':0,'width':0,'height':1}):
                with self.assertRaises(ValueError):recorder.configure({'ocr_region':region})
                with self.assertRaises(ValueError):demo.project([{**event,'ocr_region':region}])

    def test_capture_selects_a_region_without_recording_or_activating_clicks(self):
        with tempfile.TemporaryDirectory() as folder:
            packets=[];recorder=assistant.Recorder(self.config(folder),packets.append)
            image=Image.new('RGB',(100,60),'white')
            def select(im,limits,on_ready=None):
                self.assertTrue(recorder.snapshot()['capturing']);self.assertFalse(recorder.open)
                self.assertNotIn('hide',[packet.get('type') for packet in packets])
                on_ready();return 'region'
            ui=SimpleNamespace(obter_limites_tela_virtual=lambda:(0,0,100,60),selecionar_area_da_tela=select,recortar_imagem_base=lambda im,area,limits:im)
            with patch.object(assistant,'capture_module',return_value=ui),patch.object(assistant.time,'sleep'),patch('PIL.ImageGrab.grab',return_value=image):
                recorder.command({'op':'capture'})
            step=recorder.draft.current();self.assertEqual(step['source'],'selection');self.assertTrue(step['requires_confirmation']);self.assertFalse(step['confirmed']);self.assertEqual(step['kind'],'observe');self.assertFalse(recorder.armed)
            self.assertIn('capture-ready',[packet.get('type') for packet in packets]);self.assertFalse(recorder.capturing)
            self.assertFalse(any(packet.get('type')=='request' for packet in packets))
            with self.assertRaisesRegex(ValueError,'Explique'):recorder.command({'op':'capture'})

    def test_capture_cancel_and_error_release_capture_state(self):
        with tempfile.TemporaryDirectory() as folder:
            packets=[];recorder=assistant.Recorder(self.config(folder),packets.append)
            image=Image.new('RGB',(100,60),'white')
            ui=SimpleNamespace(obter_limites_tela_virtual=lambda:(0,0,100,60),selecionar_area_da_tela=lambda im,limits,on_ready=None:None)
            with patch.object(assistant,'capture_module',return_value=ui),patch.object(assistant.time,'sleep'),patch('PIL.ImageGrab.grab',return_value=image):
                recorder.command({'op':'capture'})
            self.assertFalse(recorder.capturing);self.assertFalse(recorder.open);self.assertEqual(recorder.draft.state['events'],[])
            self.assertNotIn('hide',[packet.get('type') for packet in packets])
            self.assertTrue(any(packet.get('state',{}).get('capturing') for packet in packets))
            with patch.object(assistant,'capture_module',return_value=ui),patch.object(assistant.time,'sleep'),patch('PIL.ImageGrab.grab',side_effect=RuntimeError('capture unavailable')):
                with self.assertRaisesRegex(RuntimeError,'capture unavailable'):recorder.command({'op':'capture'})
            self.assertFalse(recorder.capturing);self.assertTrue(recorder.open)


if __name__=='__main__':unittest.main()
