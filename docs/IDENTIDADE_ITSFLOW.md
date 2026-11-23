# itsflow Studio

Identidade aplicada ao Studio: nome da janela e do aplicativo, abertura, assinatura no topo, chat, tutorial e marca do relatório. O símbolo vetorial acompanha a referência de dois blocos conectados, com gradiente verde-água/ciano sobre azul profundo.

Os assets ficam em `tauri_gerador/web/assets/itsflow-mark.svg` e `itsflow-wordmark.svg`. O ícone Windows usa o mesmo símbolo em múltiplas resoluções. Os retoques de tema estão isolados em `web/itsflow-brand.css`, carregado após os estilos funcionais.

As chaves de armazenamento, o identificador Tauri, o nome interno do binário, os caminhos de dados e os protocolos existentes foram preservados para manter a compatibilidade. A detecção de janelas reconhece os nomes antigo e novo. Os nomes antigos dos arquivos técnicos não representam a identidade exibida ao usuário.

Para verificar a interface, execute `scripts/check_itsflow_brand.cjs` com `PLAYWRIGHT_MODULE` apontando ao Playwright disponível. As capturas de abertura, launcher, chat e viewport compacto são salvas em `output/itsflow-branding`. O teste não usa o banco de automações do usuário. O frontend React é recompilado com `npm run chat:build`; a validação de tipos usa `npm run chat:check`.

Abra o ambiente de desenvolvimento com `npm run tauri:dev` em `tauri_gerador`. O nome e o ícone nativos exigem reiniciar o aplicativo pelo comando de desenvolvimento. Esta alteração não gera nem publica um instalador.
