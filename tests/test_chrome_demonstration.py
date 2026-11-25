import base64
import copy
import io
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
import json
from unittest.mock import patch
from PIL import Image

import chrome_demonstration as demo
import gerenciar_roteiro as helper


class DemonstrationTests(unittest.TestCase):
    def test_selected_section_receives_blocks_without_creating_another_section(self):
        payload={'eventos':[{'ordem':1,'sequencia':'principal','tipo':'texto_livre','texto':'Inicio','detalhes':{}},
                            {'ordem':2,'sequencia':'outra','tipo':'texto_livre','texto':'Outro','detalhes':{}}],
                 'map_paths':[{'id':'existing','name':'Minha seção','entry_sequence':'outra','sequences':['outra'],'page_id':'2'}]}
        context=demo.section_context(helper,payload)
        self.assertEqual([s['id'] for s in context['sections']],['principal','outra'])
        self.assertEqual(context['sections'][1]['blocks'][0]['title'],'Outro')
        request={'session_id':'12345678-1234-1234-1234-123456789abc','revision':context['revision'],
                 'target_section':'outra','events':[{'kind':'navigate','url':'https://example.com','label':'Abrir'}]}
        saved=[]
        with tempfile.TemporaryDirectory() as folder, patch.object(helper,'PASTA_IMAGENS',Path(folder)/'images'), patch.object(helper,'DIRETORIO_PLANILHAS',Path(folder)/'sheets'), patch.object(helper,'salvar_e_retornar',side_effect=lambda draft:saved.append(copy.deepcopy(draft))):
            demo.import_demo(helper,payload,request)
            self.assertEqual(len(saved[0]['map_paths']),1)
            self.assertEqual(saved[0]['map_paths'][0],payload['map_paths'][0])
            self.assertEqual(saved[0]['eventos'][-1]['sequencia'],'outra')
            self.assertEqual(saved[0]['eventos'][:2],payload['eventos'])
            self.assertTrue(demo.import_demo(helper,saved[0],request)['already_imported'])
            request['target_section']='removed'
            with self.assertRaisesRegex(ValueError,'escolhida'):demo.import_demo(helper,payload,request)
            self.assertEqual(len(saved),1)

    def test_import_preserves_existing_map_and_creates_editable_chrome_section_once(self):
        payload = {'eventos': [{'ordem': 1, 'sequencia': 'principal', 'tipo': 'texto_livre', 'texto': 'Original', 'detalhes': {}}]}
        original = copy.deepcopy(payload)
        request = {'session_id': '12345678-1234-1234-1234-123456789abc',
                   'revision': helper.contexto_chatgpt(payload)['revision'], 'events': [
                       {'kind': 'navigate', 'url': 'https://example.com/app?q=2#/guias', 'label': 'Abrir'},
                       {'kind': 'click', 'selector': '#new', 'label': 'Novo'},
                       {'kind': 'input', 'selector': '#name', 'label': 'Nome', 'value': '{{EMPRESA}}'}]}
        saved = []
        def save(draft):
            helper.normalizar_eventos(draft)
            saved.append(copy.deepcopy(draft))
        with tempfile.TemporaryDirectory() as directory, \
             patch.object(helper, 'PASTA_IMAGENS', Path(directory) / 'images'), \
             patch.object(helper, 'DIRETORIO_PLANILHAS', Path(directory) / 'sheets'), \
             patch.object(helper, 'salvar_e_retornar', side_effect=save):
            result = demo.import_demo(helper, payload, request)
            self.assertTrue(result['imported'])
            self.assertEqual(payload, original)
            self.assertEqual(len(saved[0]['eventos']), 5)
            self.assertEqual(saved[0]['eventos'][0]['texto'], 'Original')
            section = saved[0]['map_paths'][0]
            self.assertEqual(section['engine'], 'chrome')
            self.assertEqual(section['demonstration_id'], request['session_id'])
            self.assertTrue(all(e['sequencia'] in section['sequences'] for e in saved[0]['eventos'][1:]))
            exported = [helper.converter_evento_para_chrome(e) for e in saved[0]['eventos'][1:]]
            self.assertTrue(all(warning is None for _, warning in exported), exported)
            self.assertEqual(exported[0][0]['url'], request['events'][0]['url'])
            self.assertEqual(exported[-1][0]['text'], '{{EMPRESA}}')
            self.assertTrue(demo.import_demo(helper, saved[0], request)['already_imported'])
            self.assertEqual(len(saved), 1)

    def test_changed_map_and_incomplete_fields_never_save(self):
        payload = {'eventos': []}
        request = {'session_id': '12345678-1234-1234-1234-123456789abc', 'revision': 'stale', 'events': []}
        with patch.object(helper, 'salvar_e_retornar') as save:
            with self.assertRaisesRegex(ValueError, 'mapa mudou'):
                demo.import_demo(helper, payload, request)
            request.update(revision=helper.contexto_chatgpt(payload)['revision'], events=[{'kind': 'input', 'selector': '#name', 'value': ''}])
            with self.assertRaisesRegex(ValueError, 'texto ou variável'):
                demo.import_demo(helper, payload, request)
            save.assert_not_called()

    def test_unsupported_payloads_are_rejected(self):
        for events in ([], [{'kind': 'script'}], [{'kind': 'navigate', 'url': 'javascript:alert(1)'}],
                       [{'kind': 'navigate', 'url': 'https://user:password@example.com'}],
                       [{'kind': 'click', 'selector': '<script>'}], [{'kind': 'click', 'selector': 'x'*501}]):
            with self.subTest(events=events), self.assertRaises(ValueError):
                demo.project(events)

    def test_switching_automation_never_imports_into_another_company_or_flow(self):
        request = {'automation_id': 'original-flow'}
        with patch.object(helper, 'obter_automacao_ativa_id', return_value='other-flow'), \
             patch.object(helper, 'salvar_e_retornar') as save:
            with self.assertRaisesRegex(ValueError, 'Reabra a automação'):
                demo.import_demo(helper, {'eventos': []}, request)
            save.assert_not_called()

    def test_message_capture_imports_recognition_with_image_and_never_clicks(self):
        image=io.BytesIO();Image.new('RGB',(120,40),'white').save(image,format='PNG')
        data='data:image/png;base64,'+base64.b64encode(image.getvalue()).decode()
        for text in ('Operação concluída',''):
            with self.subTest(text=text), tempfile.TemporaryDirectory() as directory:
                project=demo.project([{'kind':'observe','label':'Analisar mensagem','image':{'data_url':data},'text':text}])
                step=project['steps'][0]
                self.assertFalse(step['click'])
                self.assertEqual(step['on_failure']['action'],'parar')
                self.assertEqual(step['type'],'ocr_text' if text else 'visual_match')
                recovered=helper.converter_projeto_chrome_importado(project,Path(directory))
                event=recovered['eventos'][0]
                self.assertFalse(event['detalhes']['clicar'])
                self.assertTrue((Path(directory)/event['detalhes']['imagem']).is_file())
                if text:self.assertEqual(event['detalhes']['texto_ocr_busca'],text)
        for invalid in ('data:image/png;base64,aW52YWxpZA==','https://example.com/image.png'):
            with self.assertRaises(ValueError):demo.project([{'kind':'observe','image':{'data_url':invalid}}])

    def test_file_request_imports_snapshot_without_command_line_size_limit(self):
        payload={'eventos':[]}
        image=io.BytesIO();Image.new('RGB',(120,40),'white').save(image,format='PNG')
        data='data:image/png;base64,'+base64.b64encode(image.getvalue()).decode()
        request={'action':'demonstration_import','session_id':'12345678-1234-1234-1234-123456789abc',
                 'revision':helper.contexto_chatgpt(payload)['revision'],'padding':'x'*50000,
                 'events':[{'kind':'observe','image':{'data_url':data},'text':''}]}
        with tempfile.TemporaryDirectory() as directory:
            base=Path(directory);file=base/'request.json';file.write_text(json.dumps(request),encoding='utf-8')
            saved=[]
            with patch.object(helper,'carregar_e_normalizar',return_value=payload), \
                 patch.object(helper,'PASTA_IMAGENS',base/'images'), \
                 patch.object(helper,'DIRETORIO_PLANILHAS',base/'sheets'), \
                 patch.object(helper,'salvar_e_retornar',side_effect=lambda draft:saved.append(draft)):
                result=helper.comando_caminhos_mapa(SimpleNamespace(request=None,request_file=str(file)))
            self.assertTrue(result['imported'])
            event=saved[0]['eventos'][0]
            self.assertFalse(event['detalhes']['clicar'])
            self.assertTrue(Path(event['detalhes']['imagem']).is_file())


if __name__ == '__main__':
    unittest.main()
