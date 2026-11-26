import copy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import chrome_demonstration as demo
import desktop_assistant as assistant
import gerenciar_roteiro as helper


class InsertionRouteTests(unittest.TestCase):
    def payload(self,orphan=False):
        events=[{'ordem':1,'tipo':'texto_livre','sequencia':'principal','texto':'Início','detalhes':{}},
                {'ordem':3,'tipo':'clicar_imagem','sequencia':'principal','detalhes':{'ao_sucesso':'continuar','ocr_target_layouts':[{'texto':'Informe CNPJ','action':'confirmar_ir_para_bloco','block':4,'failureAction':'parar'}]}},
                {'ordem':4,'tipo':'texto_livre','sequencia':'destino','texto':'Outro caminho','detalhes':{}}]
        if orphan:events.append({'ordem':8,'tipo':'sequencia_planilha','sequencia':'principal','detalhes':{}})
        return {'eventos':events,'map_paths':[{'id':'main','name':'Chrome','sequences':['principal'],'engine':'chrome'},
                                             {'id':'other','name':'Desktop','sequences':['destino'],'engine':'desktop'},
                                             {'id':'empty','name':'Vazia','sequences':['vazia'],'engine':'desktop'}]}

    def test_ocr_destination_overrides_block_continue_and_blocks_append(self):
        payload=self.payload();before=copy.deepcopy(payload)
        context=demo.section_context(helper,payload)
        main=context['sections'][0]['insertion']
        self.assertFalse(main['allowed']);self.assertIn('OCR 1',main['reason']);self.assertIn('bloco 4',main['reason'])
        self.assertEqual(main['edges'],[{'source':1,'target':3,'label':'Ao concluir'},{'source':3,'target':4,'label':'OCR 1'}])
        self.assertTrue(context['sections'][1]['insertion']['allowed'])
        self.assertTrue(context['sections'][2]['insertion']['allowed'])
        self.assertEqual(payload,before)

    def test_existing_orphan_tail_is_not_treated_as_free_source(self):
        main=demo.section_context(helper,self.payload(True))['sections'][0]['insertion']
        self.assertFalse(main['allowed']);self.assertEqual(main['orphan_orders'],[8]);self.assertIn('sem caminho de entrada',main['reason'])
        self.assertFalse(any(edge['target']==8 for edge in main['edges']))

    def test_explicit_jump_stop_cycle_and_unreachable_later_ocr_are_not_free(self):
        for details in ({'ao_sucesso':'ir_para_bloco','bloco_sucesso':1},{'ao_sucesso':'parar'},
                        {'ao_sucesso':'ir_para_sequencia','sequencia_sucesso':'destino'},
                        {'ao_sucesso':'continuar','ocr_target_layouts':[{'action':'confirmar_ir_para_bloco','block':4,'failureAction':'parar'},{'action':'continuar'}]}):
            with self.subTest(details=details):
                payload=self.payload();payload['eventos'][1]['detalhes']=details
                self.assertFalse(demo.section_context(helper,payload)['sections'][0]['insertion']['allowed'])

    def test_valid_ocr_continuation_remains_available(self):
        payload=self.payload();payload['eventos'][1]['detalhes']['ocr_target_layouts'][0]['action']='clicar'
        self.assertTrue(demo.section_context(helper,payload)['sections'][0]['insertion']['allowed'])

    def test_real_return_from_another_section_can_reach_the_tail(self):
        payload=self.payload(True)
        payload['eventos'][2]['detalhes']={'ao_sucesso':'ir_para_bloco','bloco_sucesso':8}
        result=demo.section_context(helper,payload)['sections'][0]['insertion']
        self.assertTrue(result['allowed']);self.assertEqual(result['orphan_orders'],[])

    def test_import_revalidates_saved_connections_before_compiling_or_saving_sheet(self):
        payload=self.payload(True)
        request={'session_id':'12345678-1234-1234-1234-123456789abc','revision':helper.contexto_chatgpt(payload)['revision'],
                 'engine':'desktop','target_section':'principal','events':[{'kind':'manual_sheet','confirmed':True}]}
        with patch.object(helper,'salvar_e_retornar') as save:
            with self.assertRaisesRegex(ValueError,'sem caminho de entrada'):demo.import_demo(helper,payload,request)
            save.assert_not_called()

    def test_recorder_rejects_blocked_section_and_clears_stale_selection(self):
        with tempfile.TemporaryDirectory() as folder:
            config={'session_path':str(Path(folder)/'draft.json'),'automation':{'id':'test'},'revision':'r','sections':[]}
            recorder=assistant.Recorder(config,lambda _:None)
            sections=demo.section_context(helper,self.payload())['sections']
            recorder.command({'op':'map_sections','sections':sections,'revision':'r2'})
            with self.assertRaisesRegex(ValueError,'saída definida'):recorder.command({'op':'destination','target_section':'principal'})
            recorder.command({'op':'destination','target_section':'destino'})
            self.assertEqual(recorder.draft.state['target_section'],'destino')
            recorder.draft.state['target_section']='principal'
            recorder.command({'op':'map_sections','sections':sections,'revision':'r3'})
            self.assertIsNone(recorder.draft.state['target_section'])


if __name__=='__main__':unittest.main()
