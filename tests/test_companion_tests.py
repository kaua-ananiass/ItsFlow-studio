import copy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import chrome_demonstration as demo
import desktop_assistant as assistant
import gerenciar_roteiro as helper
import reconhecimento_worker as worker


class CompanionProbeTests(unittest.TestCase):
    def test_text_only_probe_disables_clicks_scrolling_and_saved_block_actions(self):
        from unittest.mock import Mock
        executor=Mock()
        executor.executar_bloco_procurar_texto_ocr.side_effect=[{'acao':'continuar'},{'acao':'parar'}]
        self.assertFalse(worker.testar_textos_sem_imagem(executor,{'texto_ocr_busca':'Downloads\nSalvar','clicar':True}))
        self.assertEqual(executor.executar_bloco_procurar_texto_ocr.call_count,2)
        for call in executor.executar_bloco_procurar_texto_ocr.call_args_list:
            settings=call.args[0]['detalhes']
            self.assertFalse(settings['clicar']);self.assertFalse(settings['varredura_scroll'])
            self.assertEqual(settings['acao_ocr'],'localizar')
            self.assertTrue(settings['teste_reconhecimento_ocr'])

    def payload(self):
        return {'eventos':[
            {'ordem':1,'id':'image-one','sequencia':'principal','tipo':'clicar_imagem','detalhes':{'nome':'Downloads','imagem':'imagens/downloads.png','modo_reconhecimento':'texto_ocr','texto_ocr_busca':'Downloads','clicar':True,'cliques':2,'leitura_relativa':{'ativo':True,'salvar_em':'conta'},'ocr_target_layouts':[{'texto':'Downloads','action':'clicar'}]}},
            {'ordem':2,'id':'text-two','sequencia':'outra','tipo':'texto_livre','texto':'começo','teclas':['texto_livre'],'detalhes':{}},
            {'ordem':3,'id':'selector-three','sequencia':'outra','tipo':'procurar_texto_ocr','detalhes':{'fonte_ocr':'elemento','texto':'#save'}}],
            'map_paths':[{'name':'Navegador','sequences':['outra'],'entry_sequence':'outra','engine':'chrome','page_id':'2'}, {'name':'Vazia','sequences':['vazia'],'entry_sequence':'vazia','engine':'desktop'}]}

    def test_catalog_includes_sections_empty_sections_and_original_previews(self):
        payload=self.payload();before=copy.deepcopy(payload)
        with patch.object(helper,'obter_automacao_ativa_id',return_value='a'):
            catalog=demo.test_catalog(helper,payload,{'automation_id':'a'})
        self.assertEqual([s['id'] for s in catalog['sections']],['principal','outra','vazia'])
        self.assertEqual(catalog['sections'][0]['blocks'][0]['image'],'imagens/downloads.png')
        self.assertEqual(catalog['sections'][1]['blocks'][0]['text'],'começo')
        self.assertEqual(catalog['sections'][2]['blocks'],[])
        self.assertFalse(catalog['sections'][1]['blocks'][1]['test_screen'])
        self.assertTrue(catalog['sections'][1]['blocks'][1]['test_chrome'])
        self.assertEqual(payload,before)

    def test_probe_uses_saved_settings_and_rejects_stale_or_changed_blocks(self):
        payload=self.payload();request={'automation_id':'a','order':1,'block_id':'image-one','revision':helper.contexto_chatgpt(payload)['revision']}
        with patch.object(helper,'obter_automacao_ativa_id',return_value='a'),patch.object(helper,'salvar_e_retornar') as save:
            result=demo.test_catalog(helper,payload,request)
            self.assertEqual(result['block']['image'],'imagens/downloads.png')
            self.assertEqual(result['worker']['imagem'],'imagens/downloads.png')
            self.assertEqual(result['worker']['texto_ocr_busca'],'Downloads')
            self.assertTrue(result['worker']['leitura_relativa']['ativa'])
            self.assertEqual(result['worker']['leitura_relativa']['salvar_em'],'')
            self.assertNotIn('clicar',result['worker'])
            self.assertEqual(result['worker']['leitura_relativa']['ocr_target_layouts'][0]['texto'],'Downloads')
            for change in ({'revision':'old'},{'block_id':'changed'},{'order':2,'block_id':'text-two'},{'order':99}):
                with self.assertRaises(ValueError):demo.test_catalog(helper,payload,{**request,**change})
            save.assert_not_called()

    def test_visual_and_image_probes_keep_their_reference_requirement(self):
        for change in ({'modo_reconhecimento':'imagem'},{'fonte_ocr':'visual'}):
            payload=self.payload();payload['eventos'][0]['detalhes'].update(change)
            with patch.object(helper,'obter_automacao_ativa_id',return_value='a'):
                result=demo.test_catalog(helper,payload,{'automation_id':'a','order':1,'block_id':'image-one','revision':helper.contexto_chatgpt(payload)['revision']})
            self.assertEqual(result['worker']['imagem'],'imagens/downloads.png')

    def test_probe_uses_current_ocr_targets_before_legacy_text_like_the_map(self):
        payload=self.payload();details=payload['eventos'][0]['detalhes']
        details['texto_ocr_busca']='Texto antigo'
        details['ocr_target_layouts']=[{'texto':'Pesquisar'},{'ocrText':'Downloads'}]
        with patch.object(helper,'obter_automacao_ativa_id',return_value='a'):
            result=demo.test_catalog(helper,payload,{'automation_id':'a','order':1,'block_id':'image-one'})
        self.assertEqual(result['worker']['texto_ocr_busca'],'Pesquisar\nDownloads')
        self.assertEqual(result['worker']['imagem'],'imagens/downloads.png')
        self.assertEqual(result['worker']['janela_alvo'],'')
        self.assertTrue(result['worker']['tela_inteira'])

    def test_text_only_remains_available_when_no_reference_is_configured(self):
        payload=self.payload();payload['eventos'][0]['detalhes'].pop('imagem')
        with patch.object(helper,'obter_automacao_ativa_id',return_value='a'):
            result=demo.test_catalog(helper,payload,{'automation_id':'a','order':1,'block_id':'image-one'})
        self.assertEqual(result['worker']['imagem'],'')
        self.assertEqual(result['worker']['texto_ocr_busca'],'Downloads')

    def test_worker_keeps_image_reference_and_requests_full_desktop_without_clicks(self):
        import io,json
        from unittest.mock import Mock
        executor=Mock();executor.testar_reconhecimento.return_value=True
        output=io.StringIO()
        with patch.object(worker,'ExecutorAutomacao',return_value=executor),patch.object(worker,'ORIGINAL_STDOUT',output),patch.object(worker.sys,'argv',['worker']),patch.object(worker.sys,'stdin',io.StringIO(json.dumps({'imagem':'downloads.png','texto_ocr_busca':'Downloads','modo_reconhecimento':'texto_ocr','tela_inteira':True})+'\n__quit__\n')),patch.object(worker,'testar_textos_sem_imagem',side_effect=AssertionError('Image reference discarded')):
            worker.main()
        self.assertTrue(json.loads(output.getvalue().splitlines()[0])['success'])
        options=executor.testar_reconhecimento.call_args.kwargs
        self.assertEqual(options['imagem'],'downloads.png')
        self.assertEqual(options['texto_ocr_esperado'],'Downloads')
        self.assertTrue(options['leitura_relativa']['_teste_tela_inteira'])
        self.assertFalse(options['clicar'])
        self.assertTrue(executor._desktop_tela_livre)

    def test_probe_status_keeps_draft_and_does_not_request_ai(self):
        with tempfile.TemporaryDirectory() as folder:
            packets=[]
            recorder=assistant.Recorder({'session_path':str(Path(folder)/'draft.json'),'automation':{'id':'a'},'revision':'r'},packets.append)
            recorder.command({'op':'create','kind':'manual_text'})
            before=copy.deepcopy(recorder.draft.state)
            recorder.command({'op':'test_begin','order':1})
            self.assertTrue(recorder.snapshot()['testing']);self.assertFalse(recorder.open)
            with self.assertRaises(ValueError):recorder.command({'op':'capture'})
            recorder.command({'op':'test_finish','result':{'order':1,'ok':True}})
            self.assertFalse(recorder.busy);self.assertFalse(recorder.testing)
            self.assertEqual(recorder.status,'Alvo encontrado')
            self.assertEqual(recorder.draft.state,before)
            self.assertFalse(any(p['type']=='request' for p in packets))


if __name__=='__main__':unittest.main()
