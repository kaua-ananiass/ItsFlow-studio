# Histórico de versões

## Atualizações de desenvolvimento — 25/11/2026

- Aura de clique no ponto real, com clique duplo e movimento reduzido.
- Recuperação dos scripts em abas existentes após trocar a extensão de pasta.
- Retorno do Desktop restaura a aura e identifica a volta ao Chrome.
- Versão publicada 0.2.101 preservada; esta branch não gera uma release da extensão.

## Atualizacoes de desenvolvimento - 24/11/2026

- Retorno Chrome/Desktop restaura a guia vinculada antes de confirmar a saida.
- Borda da guia desaparece suavemente no Desktop e retorna ao retomar o caminho Chrome.
- A versao publicada da extensao e seu historico de releases permanecem preservados.

## 0.2.101 — 23/11/2026

- Capturas agora são anexadas como imagem à análise automática, além do texto extraído da região.
- Botão Analisar imagem no rascunho para repetir uma análise sem recapturar a mensagem.
- Detecção de navegação durante a pausa de explicação, preservando o destino do clique anterior.
- Detecção de rotas SPA por histórico e hash, com proteção contra registros duplicados.

## 0.2.100 — 23/11/2026

- Demonstração de uma etapa por vez, com pausa imediata após clicar ou recortar uma mensagem.
- Análise automática da etapa e pergunta sobre a finalidade, com explicação salva no rascunho.
- Botão Gravar próxima etapa para continuar explicitamente, preservando todas as etapas anteriores.
- Brilho do ponto capturado até a borda da página e animação de recebimento no chat, com redução de movimento respeitada.

## 0.2.99 — 23/11/2026

- **Capturar mensagem** permite recortar uma área da página para etapas de análise sem clique.
- Seleção com moldura, cancelamento por Escape e miniatura no rascunho, sem ativar controles sob o recorte.
- Texto esperado revisável: importa reconhecimento de texto ou da imagem, sempre com o clique desativado.
- Imagens locais, recorte corrigido pela escala da tela e transporte ao Studio sem o limite de argumentos do Windows.

## 0.2.98 — 23/11/2026

- Conversa com rolagem própria e rascunho recolhível fixo junto ao campo de mensagem.
- Confirmação animada de clique salvo na página e no rodapé do painel.
- Cursor Assistente e contorno de campo baseados nos alvos reais da demonstração, com indicação automática na resposta e opção Mostrar.
- Destaques sem clique, com acompanhamento do alvo, duração limitada, Escape e respeito à redução de movimento.
- Alvos de outras páginas, sensíveis ou ambíguos são recusados; seletores não são fornecidos pela IA.

## 0.2.97 — 23/11/2026

- Assistente lateral em **Criar com IA**, usando a conta ChatGPT do Studio.
- Captura explícita de navegação, cliques e campos da aba escolhida, sem ler o texto digitado.
- Rascunho revisável com textos e variáveis, importado como seção Chrome editável sem executar o fluxo.
- Esfera de pensamento compartilhada com o Studio, conclusão verde e resposta com animação progressiva.
- Ponte local autenticada, verificação da automação de destino e proteção contra importação duplicada.


## 0.2.96 — pacote da release FlowDetect 4.0.0

- Versões da extensão e da ponte local alinhadas para o Studio 4.0.0.
- Inclui os recursos de tabelas, execução assistida, OCR e transferência do Studio consolidados na versão anterior.
- ZIP preparado diretamente dos arquivos de distribuição, sem dados de execução ou automações pessoais.

## 0.2.76–0.2.95 — consolidação de 11/11/2026

- Mapeamento de tabelas e botões por estrutura, com percurso por todas as linhas e páginas.
- Captura da tabela interna, retorno à lista e consolidação dos resultados em planilha.
- Diagnósticos de falhas por etapa e guia; integração com variáveis OCR.
- Correções de localização de botões, tabelas repetidas e retorno de detalhes.
- As alterações do período estão consolidadas nesta branch; nenhum ZIP é gerado por esta publicação.

## 0.2.75 — 06/11/2026

- Teste geral confirma os OCRs e lê a variável usando a mesma âncora do OCR 1.
- Resultado e destaque de variável em amarelo, com o valor encontrado.
- Removida a busca duplicada que rejeitava uma referência já confirmada pelo OCR.


## 0.2.74 — 06/11/2026

- Área Variável posicionada e redimensionada diretamente na imagem do bloco OCR.
- Leitura da região acompanha a referência e sua escala na execução.
- Compatibilidade com as variáveis configuradas antes do editor visual.

## 0.2.73 — 06/11/2026

- Captura de valores ao lado de uma referência OCR, com variáveis de texto, número, dinheiro ou data.
- Teste de captura sem cliques e rejeição de leituras vazias ou ambíguas.
- Valores disponíveis para os próximos blocos e para o desktop ao retornar de uma seção Chrome do mapa.
- Limpeza das capturas entre linhas do loop para evitar reutilizar dados de outra empresa.

## 0.2.72 — 03/11/2026

- Caminhos Chrome podem ser chamados pela árvore do mapa no Agente e devolver o fluxo ao bloco desktop indicado.
- Confirmação da execução antes de retomar o mapa, com parada em caso de perda de comunicação.
- As rotas internas continuam no Chrome; somente destinos externos declarados retornam ao executor desktop.

## 0.2.71 — 03/11/2026

- Comandos de encadeamento permitem iniciar, acompanhar e parar um fluxo Chrome pelo agente dedicado.
- Reserva das páginas durante o encadeamento para impedir outra execução ou troca de vínculo.
- Validação da aba, URL esperada e ponto de entrada antes de iniciar a etapa web.
- Variáveis compartilhadas com o processo desktop e confirmação pelo identificador de execução.
- Perda de confirmação exige conferência; a rotina não é repetida automaticamente.

## 0.2.70 — 27/10/2026

- Botão Desvincular libera a página sem fechar a aba ou excluir automações.
- Destaques de OCR acompanham a cor da página em execução, inclusive em paralelo.
- Bloqueio opcional de interação manual por página, com liberação automática e atalho Ctrl+Alt+Shift+L.
- Versões da ponte do Studio, popup e scripts alinhadas para corrigir a conexão por código.
- Inclui testes de navegador para bloqueio, cores, vínculo e inicialização da extensão.

## 0.2.69 — 26/10/2026

- Tema do painel acompanha a cor da página selecionada.
- Seção Páginas simplificada, sem moldura e com espaçamentos reduzidos.
- Inclui a correção de execução assistida antiga da versão 0.2.68.

## 0.2.68 — 26/10/2026

- Execuções assistidas deixam de exibir execuções encerradas de automações removidas da página.
- Relatórios salvos são preservados; execuções ativas continuam com monitoramento e controle de parada.

## 0.2.67 — 26/10/2026

- Imagens de referência exibidas inteiras e proporcionais na execução assistida.
- Cabeçalho do bloco compacto para dar mais espaço à imagem.
- Retiradas as linhas extras de título/página e o atalho que abria o histórico em outra guia.
- Botão Mapear ao lado de Importar, liberando a linha superior.
- Etapas recentes e controles de execução mantidos no painel compacto.

## 0.2.66 — 26/10/2026

- Removida a configuração legada de “Tela inicial”.
- Fluxos importados com essa configuração deixam de ser bloqueados por ela.
- Downloads passam a usar a pasta configurada nativamente no Chrome.
- Painel de configuração reorganizado para leitura e interação em popup compacto.
