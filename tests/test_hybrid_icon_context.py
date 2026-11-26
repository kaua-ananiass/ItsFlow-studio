import contextlib
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock
from PIL import Image,ImageDraw

import executar_automacao as motor


@unittest.skipUnless(motor.OPENCV_DISPONIVEL,'OpenCV required')
class HybridIconTests(unittest.TestCase):
    def fixture(self,folder,variant='correct',scale=1):
        image=Image.new('RGB',(140,42),(28,28,28));draw=ImageDraw.Draw(image)
        draw.text((40,15),'Downloads',fill=(240,240,240))
        draw.line([(20,8),(20,25)],fill=(20,210,190),width=2)
        draw.line([(13,19),(20,26),(27,19)],fill=(20,210,190),width=2)
        draw.line([(12,31),(28,31)],fill=(20,210,190),width=2)
        path=Path(folder)/'reference.png';image.save(path)
        patch=image.copy();draw=ImageDraw.Draw(patch)
        if variant!='correct':draw.rectangle((8,4,32,35),fill=(28,28,28))
        if variant=='different':draw.rectangle((13,12,27,26),outline=(20,210,190),width=2)
        patch=patch.resize((round(image.width*scale),round(image.height*scale)))
        screen=Image.new('RGB',(600,200),(28,28,28));screen.paste(patch,(200,60))
        executor=motor.ExecutorAutomacao.__new__(motor.ExecutorAutomacao)
        executor.capturar_tela_pil=Mock(side_effect=lambda region:(screen.crop((region[0],region[1],region[0]+region[2],region[1]+region[3])),region[0],region[1]))
        local=dict(left=200,top=60,width=patch.width,height=patch.height)
        config=dict(largura=95,altura=22,offset_x=15,offset_y=4,ocr_target_layouts=[{'texto':'Downloads','width':95,'height':22,'offsetX':15,'offsetY':4}])
        return executor,path,local,config

    def test_same_text_does_not_replace_a_missing_or_different_icon(self):
        for variant,expected in [('correct',True),('missing',False),('different',False)]:
            with self.subTest(variant=variant),tempfile.TemporaryDirectory() as folder,contextlib.redirect_stdout(io.StringIO()):
                executor,path,local,config=self.fixture(folder,variant)
                self.assertEqual(executor.confirmar_contexto_visual_fora_ocr(local,path,config),expected)

    def test_matching_icon_survives_monitor_scaling(self):
        for scale in (1.25,1.5,2):
            with self.subTest(scale=scale),tempfile.TemporaryDirectory() as folder:
                executor,path,local,config=self.fixture(folder,scale=scale)
                self.assertTrue(executor.confirmar_contexto_visual_fora_ocr(local,path,config))

    def test_correct_symbol_can_shift_three_pixels_without_being_rejected(self):
        for dx,dy in ((3,0),(-2,2),(1,-3)):
            with self.subTest(dx=dx,dy=dy),tempfile.TemporaryDirectory() as folder:
                executor,path,local,config=self.fixture(folder)
                with Image.open(path) as saved:reference=saved.convert('RGB')
                shifted=Image.new('RGB',reference.size,(28,28,28));shifted.paste(reference,(dx,dy))
                executor.capturar_tela_pil=Mock(return_value=(shifted,200,60))
                self.assertTrue(executor.confirmar_contexto_visual_fora_ocr(local,path,config))

    def test_magnifier_antialias_fragment_is_not_a_second_symbol(self):
        with tempfile.TemporaryDirectory() as folder:
            executor,path,local,config=self.fixture(folder)
            with Image.open(path) as saved:reference=saved.convert('RGB')
            draw=ImageDraw.Draw(reference);draw.line((12,3,24,3),fill=(180,180,180))
            reference.save(path)
            # This one-pixel line can disappear with different rasterization.
            self.assertTrue(executor.confirmar_contexto_visual_fora_ocr(local,path,config))

    def test_hybrid_rejects_high_scoring_template_when_its_icon_is_missing(self):
        with tempfile.TemporaryDirectory() as folder,contextlib.redirect_stdout(io.StringIO()):
            executor,path,local,config=self.fixture(folder,'missing')
            config['_ocr_anchor_first']=True
            executor.cancelamento_solicitado=Mock(return_value=False)
            executor.limitar_regiao=lambda region,**kwargs:region
            executor.confirmar_visual_proximo_ocr=Mock(return_value={**local,'score':.9})
            executor.procurar_imagem_por_template=Mock(return_value={**local,'score':.9})
            executor.confirmar_alvos_ocr_por_layout_visual=Mock(return_value={'ocr_text':'Downloads'})
            executor.ocr_hibrido_tem_todos_alvos=Mock(return_value=True)
            executor.estimar_referencia_por_alvos_ocr=Mock(return_value=dict(local))
            anchor={'left':240,'top':75,'width':60,'height':12,'texto':'Downloads','text':'Downloads','score':1}
            result=executor.localizar_referencia_hibrida_ocr_visual(path,'Downloads',dimensoes_referencia=(140,42),leitura_relativa=config,ocr_confirmado=anchor,_escala_ocr=1)
            self.assertFalse(result and result.get('visual_confirmed'))


if __name__=='__main__':unittest.main()
