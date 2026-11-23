# Criar blocos pelo mini assistente

O assistente Sync substitui a antiga aba **Gravador inteligente** no Studio. A interface, os comandos exclusivos e os destinos de orientação dessa aba foram retirados; captura de tela, reconhecimento e criação dos blocos normais continuam disponíveis pelo assistente e pelo mapa. O arquivo legado `gravador_inteligente.py` permanece separado no repositório para compatibilidade com uso direto, sem ser iniciado pela interface do Studio.

Na página **Inicial**, abra uma automação e clique em **Demonstrar no desktop**. O **Sync** aparece em um notch centralizado no topo do monitor do Studio, com a mesma esfera de pensamento do chat. Uma aura suave acompanha as bordas desse monitor. O painel abre abaixo do notch, com uma transição, e pode ser recolhido novamente. Sua conta ChatGPT deve estar conectada para as análises; o rascunho continua utilizável se a IA falhar.

Ao iniciar a demonstração, o chat mostra a animação da esfera e confirma a abertura em verde. A aura entra em uma sequência sincronizada: topo a partir do centro, laterais descendo e parte inferior fechando o contorno. Depois de aproximadamente 2,3 segundos, permanece apenas o brilho suave. A entrada se repete ao acionar **Demonstrar no desktop**, sem reiniciar em cada abertura do notch. A preferência de movimento reduzido elimina essa sequência. A abertura não envia a mensagem que estiver no campo do chat.

O notch fica ancorado no topo, substituindo a antiga janela arrastável. Clique na esfera/nome para expandir ou recolher. O ícone de câmera permite selecionar uma região diretamente. Durante o recorte, a aura continua visível e o notch mostra **Capturando área…**, com varredura animada. Nesse estado, os cliques passam pelo notch para o seletor e o teclado permanece no recortador, permitindo cancelar com **Esc**. Ao concluir, a captura volta à análise e configuração; ao cancelar, o notch retorna ao estado normal. A aura usa quatro janelas estreitas, sem foco e com passagem de cliques; se não for possível habilitar a passagem, a borda correspondente não é exibida. Notch e aura são excluídos das capturas do Windows e se ocultam ao fechar o assistente.

## Selecionar a área sem acionar o programa

1. Clique em **Selecionar área**. A mini janela se oculta e abre o recortador de tela do Studio.
2. Arraste sobre um botão, campo ou mensagem. **Esc** cancela. A seleção ocorre sobre uma imagem da tela: não aciona o aplicativo por baixo.
3. O recorte é analisado e aparece na mesma tela da conversa, sem abas. Primeiro escolha **1 clique**, **2 cliques**, **Reconhecer**, **Validação** ou **Preencher campo**. A sugestão da IA só é aplicada quando você escolhe.
4. Na etapa seguinte, defina o nome e a finalidade. Ela pode ser escrita no campo ou explicada no chat. Para preenchimento, informe também o texto ou variável; para validação, as regras de cada resultado.
5. Em **Continuar para reconhecimento**, escolha **Somente imagem** ou **Imagem + texto OCR**. No OCR, informe o texto esperado, aperte **Ajustar região do OCR** e arraste sobre esse texto na prévia. O retângulo define a região de leitura relativa à imagem; não modifica o ponto do clique. Nas ações de clique, um clique simples na prévia ajusta o ponto da ação.
6. **Concluir etapa** mostra a miniatura e a revisão. **Enviar etapas ao mapa** salva os blocos. Se quiser montar mais etapas antes, use **Próxima área**. **Voltar** permite revisar as escolhas; a conversa continua disponível em toda a sequência.

Este modo não instala gravadores globais de cliques ou de texto digitado. Para navegar de verdade até outra tela, opere o programa normalmente fora da seleção e depois selecione o próximo alvo.

## Comportamentos definidos

| Opção | Ao executar o fluxo |
| --- | --- |
| 1 clique | Reconhece a imagem e clica uma vez no ponto configurado. |
| 2 cliques | Reconhece a imagem e executa dois cliques no ponto configurado. |
| Reconhecer | Confirma a imagem sem clicar; continua quando encontra e para se não encontrar. |
| Validação | Reconhecimento sem clique para uma situação específica. Configure o que ocorre **quando aparecer** e **se não aparecer**. |
| Preencher campo | Cria dois blocos: reconhecer/clicar no campo e escrever o texto fixo ou `{{VARIAVEL}}` informado. A revisão mostra o alvo e o conteúdo a preencher. |

Por padrão, **Validação** para a automação quando encontra a imagem e continua quando não a encontra. As duas regras podem ser alteradas para Continuar ou Parar. Essa distinção permite tratar uma mensagem eventual sem exigir sua presença em todas as execuções.

O ponto de clique começa no centro do recorte. Nas opções de clique e preenchimento, clique **na imagem da miniatura** para ajustá-lo. Isso muda apenas a configuração: não clica no programa. Reconhecimento e Validação exibem **Sem clique** e não mostram um ponto de ação.

## Confirmar e salvar no mapa

A miniatura aparece ao configurar o reconhecimento e, na revisão final, mostra as regras “se encontrar” e “se não encontrar”. Alterar um bloco concluído exige concluir novamente. Uma finalidade é obrigatória; para preenchimento, também é obrigatório definir o texto ou variável. O nome e a finalidade não são usados como texto a digitar. O texto esperado no OCR é independente desses campos; ele é obrigatório quando OCR está ativo. O reconhecimento desktop com OCR usa a imagem de referência e a região relativa configurada, preservando o comportamento de clicar ou apenas reconhecer.

O botão **Configurar etapa**, junto ao contador no rodapé, abre o rascunho, **Descartar última**, **Atualizar destino** e **Enviar etapas ao mapa**. O envio cria uma seção **Demonstração Desktop** com os blocos reais de reconhecimento/texto, sem executar a automação. Após a confirmação do Studio, o painel recolhe ao notch, a esfera sinaliza o salvamento e o assistente prepara um novo rascunho para a mesma automação, com a revisão atualizada do mapa. Clique na câmera para capturar o próximo alvo; não é necessário fechar o assistente. Um novo identificador impede que o próximo envio seja confundido com o anterior. Se o envio falhar, a etapa permanece editável e não é descartada.

Se você editou o mapa no Studio, atualize o destino e revise antes de enviar. A automação ativa precisa continuar sendo a mesma. A importação verifica a revisão e evita duplicar uma demonstração já enviada.

## Retomar e limites

Fechar a caixa preserva o rascunho por automação na pasta de dados do aplicativo, em `desktop-demonstrations`. Depois de enviar ao mapa, o próximo rascunho é preparado automaticamente, sem encerrar a sessão. A mini janela ajusta seu tamanho ao monitor; em telas menores, a área interna permite rolagem sem esconder o campo de conversa.

O mini assistente usa reconhecimento visual do desktop mesmo quando o alvo é do Chrome. Não transfere automaticamente DOM, tabelas ou rotas da extensão. Esses recursos continuam disponíveis pelos mapeamentos Chrome existentes. Atalhos, loops, planilhas e outras ações além das opções acima continuam sendo configurados pelos editores do mapa.

Somente o recorte selecionado e as explicações são enviados à IA; a tela completa usada localmente pelo recortador não é enviada. Evite incluir informações confidenciais na região escolhida. O processo de captura não recebe tokens nem credenciais da conta: pede ao Studio as análises por um canal local. Interpretar visualmente um controle é uma sugestão, não garantia da sua finalidade; a confirmação é explícita.

## Verificações de desenvolvimento

- `npm run chat:build` e `npm run chat:check`, em `tauri_gerador`.
- `cargo check --locked`, em `tauri_gerador/src-tauri`.
- `python -m unittest tests.test_desktop_assistant tests.test_chrome_demonstration tests.test_map_paths -q`.
- `node scripts/check_desktop_companion.cjs`: notch recolhido, expansão, seleção, imagem, cinco comportamentos, região OCR, âncora, Validação, confirmação e importação com IPC/modelo simulados.
- `node scripts/check_universal_chat.cjs`: integração com o chat do Studio e transições de conclusão.

Os testes não realizam cliques reais nos programas do usuário nem consomem a conta ChatGPT.
