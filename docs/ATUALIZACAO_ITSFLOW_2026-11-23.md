# itsflow Studio — identidade e assistente Sync

O FlowDetect passa a se apresentar como **itsflow Studio**. A atualização reúne a nova identidade visual, o chat universal e a criação de blocos pelo assistente Sync no desktop e no Chrome.

## Interface

- **Inicial** é a primeira aba e a página de abertura, com o chat universal, histórico e mapa ao lado da conversa.
- Robô minimalista e nome **Sync — Assistente do Flow** no cabeçalho do chat.
- Abertura com logotipo, brilho suave e entrada dos elementos; troca de abas com fade e movimento leve.
- Esfera de processamento maior e centralizada verticalmente, adaptada a janelas menores; respostas surgem progressivamente.
- Fundo do Launcher em azul-escuro. O Gravador inteligente foi retirado da interface e dos comandos exclusivos; reconhecimento, captura e criação de blocos compartilhados foram preservados.

## Demonstração e criação de blocos

- **Demonstrar no desktop** abre o Sync em um notch no topo do monitor do Studio, com esfera e aura nas bordas.
- A seleção de uma região não clica no aplicativo por baixo. Primeiro escolha 1 clique, 2 cliques, reconhecer, validação ou preencher campo; depois explique a finalidade e ajuste o reconhecimento.
- OCR permite informar o texto esperado e delimitar a região de leitura na imagem. Finalidade, texto esperado e texto a preencher são campos independentes.
- A prévia usa as configurações que chegam aos blocos reais. A importação verifica automação e revisão, evita duplicatas e não executa o fluxo.
- Após salvar no Studio, o assistente recolhe e prepara a próxima captura sem reiniciar. Falhas de envio preservam a etapa para correção e nova tentativa.
- Durante o recorte, aura e notch continuam visíveis com **Capturando área…**. Os cliques passam para o seletor; **Esc** cancela.
- Janela sem moldura nativa ativa/inativa e sem salto lateral ao expandir. As animações respeitam movimento reduzido.
- O painel de demonstração da extensão Chrome registra etapas da aba autorizada, recortes e navegação, com perguntas sobre a finalidade e rascunho revisável.

## Compatibilidade e publicação

- A versão de código do Studio continua **4.0.0**, preservando a versão já publicada; esta atualização não cria uma nova release nem um instalador.
- Extensão e ponte local estão alinhadas em **0.2.101**.
- Identificador Tauri, nomes internos do binário e caminhos de dados existentes foram mantidos para compatibilidade com instalações e automações anteriores.
- Capturas de verificação, dados pessoais, configurações locais, exportações de automações e caches não fazem parte desta atualização.

## Validação

- `npm run chat:check` e `npm run chat:build`.
- `cargo check --locked` e teste nativo `overlay_frame_tests`, que verifica repintura de moldura e preservação das notificações de foco.
- 43 testes Python selecionados: criação guiada, assistente desktop, demonstração e caminhos do mapa; um teste depende do runtime embutido e foi ignorado no checkout isolado.
- Verificações do mini assistente e do chat universal no navegador, incluindo OCR, envio consecutivo sem duplicatas, centralização da esfera e retorno ao notch.
- Teste de navegação da interface sem os recursos descontinuados.

As verificações de interface usam IPC/modelo simulados. Não consomem a conta ChatGPT nem executam automações nos sistemas do usuário. O comportamento visual completo das janelas nativas deve ser conferido na instalação Windows.

Documentação: [Assistente desktop](ASSISTENTE_DESKTOP.md), [Chat universal](CHAT_UNIVERSAL_ITSFLOW.md), [Demonstração Chrome](CHROME_DEMONSTRACAO.md), [Identidade](IDENTIDADE_ITSFLOW.md).
