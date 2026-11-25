import unittest
from unittest.mock import Mock, patch
import sys
import types
import executar_automacao as motor


class HandoffTests(unittest.TestCase):
    def test_desktop_click_focus_is_not_replaced_by_inherited_chrome_context(self):
        executor=self.executor()
        executor._desktop_tela_livre=True;executor._desktop_bloco_sem_alvo=True
        executor.resolver_janela_evento=Mock(return_value='FGTS - Google Chrome')
        executor.ativar_janela_alvo=Mock()
        self.assertIsNone(executor.preparar_janela_para_acao())
        executor.resolver_janela_evento.assert_not_called()
        executor.ativar_janela_alvo.assert_not_called()
        executor.preparar_janela_para_acao('Programa escolhido')
        executor.ativar_janela_alvo.assert_called_once()

    @unittest.skipUnless(motor.os.name == 'nt', 'Win32 only')
    def test_studio_handoff_emits_one_surface_event_and_preserves_execution(self):
        executor=self.executor();executor._pulso_retorno_chrome_pendente=True
        executor.preparar_retorno_chrome_desktop=Mock()
        executor._executar_evento_com_cursor=Mock(return_value={'acao':'continuar'})
        pulse=Mock();analysis=Mock()
        with patch.dict(motor.os.environ,{'FLOWDETECT_EXECUTION_SURFACE':'1'}), patch.object(motor,'safe_print') as output, patch.dict(sys.modules,{'_flowdetect_marcador_visual':types.SimpleNamespace(pulsar_retorno_desktop_windows=pulse,definir_analise_tela_windows=analysis)}):
            executor.executar_evento({'tipo':'abrir_programa'})
            executor.executar_evento({'tipo':'clicar_imagem'})
            executor.analisar_com_cursor_flow(True)
        output.assert_called_once_with('EXECUTION_SURFACE|desktop',flush=True)
        pulse.assert_not_called();analysis.assert_not_called()
        self.assertTrue(executor._superficie_desktop_ativa)
        self.assertEqual(executor._executar_evento_com_cursor.call_count,2)

    @unittest.skipUnless(motor.os.name == 'nt', 'Win32 only')
    def test_pulse_runs_once_on_entry_even_before_open_program(self):
        executor=self.executor();executor._pulso_retorno_chrome_pendente=True
        executor.preparar_retorno_chrome_desktop=Mock()
        executor.analisar_com_cursor_flow=Mock()
        executor._executar_evento_com_cursor=Mock(return_value={'acao':'continuar'})
        pulse=Mock()
        with patch.dict(sys.modules,{'_flowdetect_marcador_visual':types.SimpleNamespace(pulsar_retorno_desktop_windows=pulse)}):
            executor.executar_evento({'tipo':'abrir_programa'})
            executor.executar_evento({'tipo':'clicar_imagem'})
        pulse.assert_called_once()
        self.assertEqual(executor._executar_evento_com_cursor.call_count,2)

    def executor(self):
        executor=motor.ExecutorAutomacao.__new__(motor.ExecutorAutomacao)
        executor.janela_alvo=''
        executor._janela_contexto='Chrome antigo'
        executor._retorno_chrome_pendente=True
        executor._cache_ocr_curto={'old':1};executor._cache_ocr_screenshot={'old':1};executor._historico_reconhecimento={'old':1}
        executor.alvo_execucao_ativo=Mock(return_value=False)
        executor.esperar=Mock(return_value=True)
        executor.obter_janela_ativa=Mock(return_value={'title':'Janela atual','left':100,'top':80,'width':900,'height':600})
        executor.janela_parece_interface_flowdetect=Mock(return_value=False)
        return executor

    def test_first_desktop_recognition_refreshes_passive_scope_and_caches(self):
        executor=self.executor()
        executor.preparar_retorno_chrome_desktop({'tipo':'clicar_imagem','detalhes':{}})
        self.assertEqual(executor._janela_contexto,'')
        self.assertTrue(executor._desktop_tela_livre)
        self.assertIsNone(executor._janela_fixada)
        executor.obter_janela_ativa.assert_not_called()
        self.assertEqual(executor._cache_ocr_screenshot,{})
        self.assertEqual(executor._cache_ocr_curto,{})
        self.assertEqual(executor._historico_reconhecimento,{})
        self.assertFalse(executor._retorno_chrome_pendente)

    def test_open_program_before_recognition_does_not_pin_the_browser_again(self):
        executor=self.executor()
        executor.preparar_retorno_chrome_desktop({'tipo':'abrir_programa'})
        self.assertTrue(executor._retorno_chrome_pendente)
        executor.obter_janela_ativa.assert_not_called()
        executor.preparar_retorno_chrome_desktop({'tipo':'procurar_texto_ocr'})
        self.assertEqual(executor._janela_contexto,'')
        self.assertTrue(executor._desktop_tela_livre)

    def test_explicit_target_is_not_replaced_by_foreground_window(self):
        for details,configured,fixed in [({'janela_alvo':'Definida'},'',False),({},'Definida',False),({},'',True)]:
            with self.subTest(details=details,configured=configured,fixed=fixed):
                executor=self.executor();executor.janela_alvo=configured;executor.alvo_execucao_ativo.return_value=fixed
                executor.preparar_retorno_chrome_desktop({'tipo':'clicar_imagem','detalhes':details})
                executor.obter_janela_ativa.assert_not_called()
                self.assertEqual(executor._janela_contexto,'Chrome antigo')
