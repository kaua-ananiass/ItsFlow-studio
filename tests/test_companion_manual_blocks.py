import copy
import tempfile
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from openpyxl import Workbook

import desktop_assistant as assistant
import chrome_demonstration as demo
import gerenciar_roteiro as helper


class ManualBlockTests(unittest.TestCase):
    def test_import_and_key_configuration_in_isolated_python_without_project_imports(self):
        driver=r'''
import copy,importlib.util,sys,tempfile
from pathlib import Path
from openpyxl import Workbook
root=Path(sys.argv[1]).resolve()
assert str(root) not in sys.path
def load(name,filename):
    spec=importlib.util.spec_from_file_location(name,root/filename)
    module=importlib.util.module_from_spec(spec)
    sys.modules[name]=module
    spec.loader.exec_module(module)
    return module
helper=load('isolated_generator','gerenciar_roteiro.py')
demo=load('isolated_demonstration','chrome_demonstration.py')
assistant=load('isolated_assistant','desktop_assistant.py')
helper.obter_automacao_ativa_id=lambda:'test'
book=Workbook();book.active.title='Clientes';book.active.append(['Empresa']);book.active.append(['Empresa exemplo'])
Path('planilhas').mkdir();book.save('planilhas/clientes.xlsx');book.close()
for kind in ('manual_text','manual_keys','manual_sheet'):
    event={'kind':kind,'label':'Exemplo','description':'Minha etapa','confirmed':True,'value':'ctrl+a' if kind=='manual_keys' else 'inicio',
           'workbook':'planilhas/clientes.xlsx','sheet':'Clientes','column':'Empresa','loop':True}
    payload={'eventos':[]};saved=[]
    helper.salvar_e_retornar=lambda value:saved.append(copy.deepcopy(value))
    request={'automation_id':'test','session_id':'12345678-1234-1234-1234-123456789abc','engine':'desktop',
             'target_section':'__new__','revision':helper.contexto_chatgpt(payload)['revision'],'events':[event]}
    assert demo.import_demo(helper,payload,request)['imported']
    assert len(saved[0]['eventos'])==1
    assert demo.import_demo(helper,saved[0],request)['already_imported']
    if kind=='manual_sheet':assert saved[0]['eventos'][0]['detalhes']['valores']==['Empresa exemplo']
recorder=assistant.Recorder({'session_path':'session.json','automation':{'id':'test'},'revision':'r'},lambda _:None)
recorder.command({'op':'create','kind':'manual_keys'})
recorder.command({'op':'confirm','value':'ctrl+a'})
assert recorder.draft.current()['confirmed']
assert 'desktop_assistant' not in sys.modules and 'gerenciar_roteiro' not in sys.modules
print('isolated imports OK')
'''
        with tempfile.TemporaryDirectory() as folder:
            result=subprocess.run([sys.executable,'-I','-c',driver,str(Path(helper.__file__).resolve().parent)],cwd=folder,capture_output=True,text=True,timeout=60)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertIn('isolated imports OK',result.stdout)

    def test_text_and_key_wizard_only_requests_import_not_ai(self):
        for kind,value in [('manual_text','começo {{EMPRESA}}'),('manual_keys','ctrl+a')]:
            with self.subTest(kind=kind),tempfile.TemporaryDirectory() as folder:
                packets=[]
                recorder=assistant.Recorder({'session_path':str(Path(folder)/'draft.json'),'automation':{'id':'test'},'revision':'r1','sections':[]},packets.append)
                recorder.command({'op':'create','kind':kind})
                recorder.command({'op':'confirm','value':value,'repetitions':2,'builder_stage':3})
                self.assertTrue(recorder.draft.current()['confirmed'])
                recorder.command({'op':'destination','target_section':'__new__'})
                recorder.command({'op':'import'})
                self.assertEqual([p['operation'] for p in packets if p['type']=='request'],['import'])
                blocks=assistant.compile_manual(helper,packets[-1]['events'])
                self.assertEqual(blocks['eventos'][0]['tipo'],'texto_livre' if kind=='manual_text' else 'atalho')

    def test_invalid_key_cannot_advance_or_be_confirmed(self):
        with tempfile.TemporaryDirectory() as folder:
            recorder=assistant.Recorder({'session_path':str(Path(folder)/'draft.json'),'automation':{'id':'test'},'revision':'r1'},lambda _:None)
            recorder.command({'op':'create','kind':'manual_keys'})
            with self.assertRaisesRegex(ValueError,'desconhecida'):
                recorder.command({'op':'confirm','value':'not-a-real-key','builder_stage':3})
            self.assertFalse(recorder.draft.current()['confirmed'])
            self.assertEqual(recorder.draft.current()['builder_stage'],0)

    def test_spreadsheet_import_preserves_section_and_enables_loop_only_on_request(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);sheets=root/'planilhas';sheets.mkdir();file=sheets/'clientes.xlsx'
            workbook=Workbook();sheet=workbook.active;sheet.title='Clientes';sheet.append(['Empresa','CNPJ']);sheet.append(['A','001']);sheet.append(['B','002']);workbook.save(file);workbook.close()
            original={'eventos':[{'ordem':1,'sequencia':'destino','tipo':'texto_livre','texto':'Antes','detalhes':{}}],
                      'map_paths':[{'id':'sec','name':'Escolhida','entry_sequence':'destino','sequences':['destino'],'page_id':'2','engine':'desktop'}]}
            for loop in (False,True):
                saved=[]
                event={'kind':'manual_sheet','label':'Ler clientes','description':'Preencher empresa','workbook':'planilhas/clientes.xlsx','sheet':'Clientes','column':'Empresa','loop':loop,'confirmed':True,'after_action':'tab','interval':.3}
                request={'engine':'desktop','session_id':'12345678-1234-1234-1234-123456789abc','revision':helper.contexto_chatgpt(original)['revision'],'target_section':'destino','events':[event]}
                with patch.object(helper,'DIRETORIO_PLANILHAS',sheets),patch.object(helper,'resolver_planilha',return_value=file),patch.object(helper,'salvar_e_retornar',side_effect=lambda p:saved.append(copy.deepcopy(p))):
                    result=demo.import_demo(helper,original,request)
                    block=saved[0]['eventos'][-1]
                    self.assertEqual(block['sequencia'],'destino')
                    self.assertEqual(block['tipo'],'sequencia_planilha')
                    self.assertEqual(block['detalhes']['valores'],['A','B'])
                    self.assertEqual(block['detalhes']['acao_apos_item'],['tab'])
                    self.assertEqual(saved[0]['map_paths'],original['map_paths'])
                    self.assertEqual('destino' in saved[0].get('configuracoes_sequencia',{}),loop)
                    self.assertTrue(result['imported'])
                    self.assertTrue(demo.import_demo(helper,saved[0],request)['already_imported'])
                self.assertEqual(len(original['eventos']),1)

    def test_missing_column_and_unconfirmed_blocks_never_save(self):
        for event in ({'kind':'manual_sheet','confirmed':True},{'kind':'manual_text','value':'teste'}):
            with self.assertRaises(ValueError):assistant.compile_manual(helper,[event])


if __name__=='__main__':unittest.main()
