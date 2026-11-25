# Atualizacao itsflow Studio - 24/11/2026

Esta branch continua a versao 4.0.0 publicada, sem criar uma nova release.

## O que muda

- Ctrl +, Ctrl - e Ctrl 0 ajustam o zoom da interface e preservam a escala escolhida.
- Conta e modelo do ChatGPT ficam em um painel vertical junto ao historico de conversas, com expansao suave.
- Capturar e configurar um bloco nao chama a IA automaticamente; o chat continua disponivel para perguntas explicitas.
- O assistente apresenta uma miniatura das secoes para escolher onde enviar o bloco, sem recriar conexoes existentes.
- Secoes vazias podem ser criadas e receber seu primeiro bloco no inicio da area. O interruptor Chrome muda o modo da secao e sua cor suavemente.
- A execucao local prepara a ponte autenticada com a extensao. O caminho Chrome devolve a guia correta antes de entrar no Desktop.
- A primeira busca no Desktop renova o contexto e pode incluir a barra de tarefas; alvos explicitos continuam respeitados.
- O reconhecimento confirmado mostra o contorno OCR encontrado. O cursor real e o foco permanecem sob controle da execucao.
- A aura e o notch usam o visual do Sync. A entrada mostra Entrando no Desktop e depois Executando no Desktop.
- Os eventos visuais sao processados em ordem; o notch reaplica a entrada quando termina de carregar e encerra ao voltar ao Chrome ou finalizar o processo.

## Abrir o desenvolvimento em outra pasta

Feche a instancia anterior do Studio e execute no PowerShell, substituindo o caminho:

```powershell
cd "<pasta-do-projeto>\tauri_gerador"
npm.cmd ci --include=dev
npm.cmd run tauri:dev
```

`npm.cmd ci` instala as dependencias a partir do lockfile, inclusive esbuild e o CLI do Tauri. Copiar o codigo e os arquivos gerados nao substitui essa instalacao.

Em um checkout novo no Windows, prepare tambem os recursos do instalador a partir da raiz do projeto:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts/preparar_build_windows.ps1
```

O preparo verifica o SHA256 do instalador oficial do Python. Esse executavel e um recurso de build gerado e nao entra nos commits.

O arquivo `Abrir-itsflow-Dev.cmd` abre um executavel de desenvolvimento ja compilado em `tauri_gerador/target/debug/itsflow-studio-dev.exe`. Para recompilar alteracoes de codigo, use o comando `tauri:dev` acima.

Recarregue a extensao em `chrome://extensions` ao alterar seus arquivos. Alteracoes Rust exigem recompilar e reiniciar o Studio.

## Roteiro de verificacao manual

1. Abra o painel de contas na lateral e ajuste o zoom com os atalhos.
2. Capture uma area no assistente, configure o bloco sem enviar perguntas e escolha uma secao na miniatura.
3. Crie uma secao vazia, adicione seu primeiro bloco e alterne o interruptor Chrome.
4. Execute uma secao Chrome ligada a um reconhecimento Desktop. Confira a guia correta, o contorno OCR e o notch.
5. Repita a transicao Chrome/Desktop, incluindo a primeira abertura do notch. Confira a entrada e a limpeza visual ao encerrar.

## Commits desta atualizacao

1. **feat(studio): adicionar zoom da interface por teclado**

   Permite ampliar, reduzir e restaurar a interface com Ctrl +, Ctrl - e Ctrl 0. Preserva a escala escolhida sem interferir na captura de atalhos.

2. **feat(chat): organizar contas na lateral das conversas**

   Move conta e modelo para um painel vertical junto ao historico. Adiciona expansao suave e abre a conexao quando o usuario ainda nao esta autenticado.

3. **feat(sync): preparar captura local e destino das demonstracoes**

   Configura recortes e blocos sem chamar a IA automaticamente. Mantem o contexto das secoes, valida o destino e evita importar a mesma demonstracao duas vezes.

4. **feat(sync): escolher a secao em uma miniatura do mapa**

   Inclui uma etapa visual para escolher a secao antes de enviar o bloco. Sincroniza os comandos nativos e as secoes disponiveis para evitar o erro de controle invalido.

5. **feat(mapa): configurar secoes Chrome e preservar secoes vazias**

   Adiciona um interruptor Chrome por secao com transicao de cores. Permite secoes vazias e posiciona a criacao do primeiro bloco no inicio da secao.

6. **fix(runtime): preparar a ponte Chrome na execucao local**

   Cria uma caixa de mensagens privada para cada processo iniciado pelo Studio. Mantem a ponte durante a execucao e limpa seus recursos quando o processo termina ou falha ao iniciar.

7. **fix(chrome): restaurar a guia e suavizar a saida para o desktop**

   Restaura a guia vinculada antes de confirmar a saida do caminho Chrome. Oculta sua borda com uma transicao suave e reaplica o destaque quando a execucao retorna.

8. **fix(ocr): reconhecer a tela inteira ao sair do Chrome**

   Renova o escopo e os caches na primeira busca Desktop, incluindo a barra de tarefas. Preserva alvos explicitos e mostra o contorno OCR encontrado durante a execucao.

9. **feat(execucao): mostrar aura e notch Sync no desktop**

   Reutiliza a aura do assistente e mostra Entrando no Desktop e Executando no Desktop. Ordena os eventos e reaplica a entrada apos o carregamento para evitar transicoes perdidas, sem capturar foco ou afetar screenshots.

10. **docs(itsflow): documentar desenvolvimento e verificacao da atualizacao**

    Registra os recursos e a instalacao das dependencias ao mudar de pasta. Atualiza o teste visual para a escolha de secao, inclui o atalho de desenvolvimento e preserva as notas publicadas.
