# itsflow — execução assistida e OCR — 25/11/2026

Branch: `feature/itsflow-execucao-assistida-ocr-2026-11-25`.
Base: `feature/itsflow-sync-desktop-2026-11-24` (`b5323d7`), que já contém a branch principal. Esta publicação acrescenta dez commits; não cria release, instalador ou nova versão da extensão. Os números publicados do Studio 4.0.0 e da extensão 0.2.101 foram preservados.

## Os dez commits

1. **OCR em caminhos com acentos** — imagens decodificadas por bytes, preparação dos modelos Tesseract e saída UTF-8 dos processos.
2. **Execução Desktop alinhada ao Procurar** — contexto da janela renovado, escalas DPI ampliadas, espera pelo timeout e destaque do OCR antes da ação.
3. **Ações individuais do OCR importado** — clique, clique duplo e regra de falha preservados na demonstração enviada ao mapa.
4. **Aura nativa de clique** — efeito suave no ponto real, com quantidade de cliques propagada ao marcador e sem entrada extra.
5. **Aura de clique no Chrome** — ondas por clique, suporte a movimento reduzido e teste que garante ausência de cliques disparados pela animação.
6. **Recuperação da extensão e retorno do Desktop** — injeção na aba existente após mudar a extensão de pasta, validação do vínculo, erros úteis da ponte e aura de retorno ao Chrome.
7. **Execução assistida minimalista** — canvas com arraste e zoom, cards essenciais, comandos no canto, menu recolhível e progresso com raio. Não desenha caminhos entre seções.
8. **Regressão visual e acessibilidade** — teste do canvas real, cards sem controles de edição, pan/zoom, menu e limites/atributos da barra de progresso.
9. **Reconexão ChatGPT** — tratamento de autorização expirada, diagnóstico HTTP preservado, reconexão acessível e bundle React atualizado, sem apagar conversas.
10. **Documentação da publicação** — resumo das mudanças, dos testes e das decisões sobre os arquivos enviados.

Cada commit também tem uma descrição curta no corpo da mensagem do Git.

## Validação

- **112 testes Python**: caminhos Unicode (4), âncoras OCR (52), diagnóstico (12), transição Chrome/Desktop (6), cursor (10), caminhos do mapa (12) e assistente desktop (16).
- **49 testes JavaScript**: extensão e ponte, retorno da aura, efeitos de clique, inserção do mapa, limpeza da interface e novo canvas assistido.
- **12 testes Rust do ChatGPT** aprovados; 2 diagnósticos que exigem autorização explícita/login real ficaram ignorados.
- `chat:build` e `chat:check` aprovados.
- Verificação de navegador do chat universal aprovada, incluindo perguntas, edição em lote no mapa real, recuperação de erro e painel compacto.

Os testes simulam os eventos externos e o acesso à tela. Não equivalem à homologação de toda automação real ou do login de uma conta ChatGPT. Não houve publicação de release nem execução de automações pessoais para validar a branch.

Um teste antigo da extensão exigia ausência total de `chrome.debugger`, embora o fechamento nativo de tabelas já o utilizasse na base publicada. Ele foi substituído por uma verificação do comportamento: executar um bloco de tecla não chama o debugger.

## Organização e limites

A publicação foi preparada em checkout separado para preservar a cópia de desenvolvimento. Não inclui o Aden/mapeador contábil, capturas privadas, planilhas, automações pessoais, caches, cópias empacotadas da extensão ou alterações do Python embarcado. Documentos antigos e metadados locais que reverteriam versões publicadas não foram sobrepostos.

Para testar a mudança da extensão de pasta, carregue a pasta `flowdetect_chrome` desta branch no modo de desenvolvedor do Chrome e refaça o vínculo da aba quando solicitado. Páginas restritas do próprio Chrome não permitem injeção de scripts.

Para desenvolvimento, use `Abrir-itsflow-Dev.cmd` e instale as dependências do diretório `tauri_gerador` conforme o README. Não há merge automático desta branch na principal.
