# Criar uma automação demonstrando no Chrome

O **Criar com IA** fica na extensão existente. O painel lateral acompanha uma aba escolhida e usa a conta ChatGPT conectada ao itsflow Studio. A esfera de processamento é o mesmo componente do chat do Studio: fica verde ao concluir e a resposta aparece progressivamente.

## Atualizar e abrir

1. Reinicie o Studio com `npm run tauri:dev` em `tauri_gerador`.
2. Em `chrome://extensions`, recarregue a extensão da pasta `flowdetect_chrome`. A versão precisa ser **0.2.101**, correspondente à ponte do Studio. A atualização inclui a permissão `sidePanel`.
3. Conecte a extensão ao Studio pelo código habitual. No Studio, abra a automação de destino e conecte sua conta ChatGPT para conversar.
4. Na extensão, clique em **Criar com IA**. O assistente abre ao lado da página. Se o Studio foi iniciado depois, clique em **Atualizar conexão**.

## Demonstrar e enviar os blocos

1. Na aba desejada, clique em **Demonstrar esta aba**.
2. Faça uma ação na página. Um brilho segue até a borda do chat e a gravação pausa imediatamente. O assistente analisa só essa etapa e pergunta a finalidade. Responda no chat; sua explicação fica salva junto à etapa. Depois clique em **Gravar próxima etapa** para capturar outra ação. Os cliques feitos durante a pausa não são gravados. Navegações de contexto ficam no rascunho, mas não iniciam outra pergunta automaticamente.
3. A análise automática usa a conta ChatGPT do Studio. Se ocorrer uma falha, a ação permanece salva e o painel faz uma pergunta local para você descrevê-la. A gravação só é rearmada explicitamente, depois da explicação. Você também pode conversar para tirar dúvidas. Para campos de texto, clicar no campo registra a etapa de preenchimento; o conteúdo não é lido, portanto configure texto ou variável no rascunho.
4. Clique em **Encerrar**. O **Rascunho**, fixo no rodapé, abre para revisão. Remova ações desnecessárias. Para cada campo, informe explicitamente o texto fixo ou a variável, por exemplo `{{EMPRESA}}`. O texto que você digitou na página não é copiado.
5. Clique em **Enviar ao Studio**. Uma seção Chrome separada aparece no mapa com blocos editáveis. Um preenchimento gera o alvo de clique e o bloco de texto. O envio não inicia a execução.
6. Revise os alvos, as variáveis, as esperas e as conexões antes de executar. Se o mapa mudou durante a demonstração, use **Atualizar destino**, revise e envie novamente. A automação ativa precisa continuar sendo a mesma.

## O que esta primeira versão captura

- Navegação HTTP/HTTPS, cliques em controles e campos de texto da página principal.
- Até 50 ações por trecho, com pausa automática ao atingir o limite.
- Mudança para outro site pausa a captura; **Retomar** autoriza explicitamente o novo site.
- Rascunho preservado na sessão do Chrome quando o painel é fechado; **Nova** permite descartá-lo.
- Importação identificada para impedir duplicação ao repetir o envio.

Seleções de listas nativas, arquivos, downloads, atalhos, iframes, Shadow DOM e elementos desenhados em canvas precisam ser configurados nos blocos adequados do Studio. O assistente desta etapa observa e orienta; ainda não clica autonomamente no site. Os alvos são seletores CSS e podem precisar de ajuste quando a página usa identificadores dinâmicos.

## Cursor e confirmação de captura

### Etapas em que você apenas lê uma mensagem

Clique em **Capturar mensagem** e arraste um retângulo sobre a mensagem na página. O modo **Analisar mensagem** mostra a moldura do recorte; **Esc** cancela. O gesto é consumido pelo seletor, sem clicar nos controles da página. Selecione somente a mensagem, sem campos de preenchimento.

O recorte aparece no rascunho como **Analisar mensagem**, com miniatura. Quando o texto está disponível na página, o campo de texto esperado é preenchido para revisão. Você pode corrigir esse texto ou deixá-lo vazio para usar somente a imagem. Na importação, texto preenchido cria reconhecimento de texto; sem texto, cria reconhecimento visual da imagem. Ambos ficam com **clique desativado**, aguardam a mensagem e param se não a encontrarem. Configure os próximos passos no mapa conforme o resultado esperado.

Ao concluir um recorte, a análise automática envia **somente a região selecionada** à IA como imagem, junto ao texto extraído e à estrutura da demonstração. Não envia a tela completa nem outros recortes do rascunho. O assistente descreve a mensagem visível e pergunta qual resultado é esperado. O botão **Analisar imagem** repete a análise do recorte escolhido caso ela falhe. A análise depende de um modelo com suporte a imagens e dos limites da conta conectada. São permitidos até oito recortes por demonstração, dentro do limite geral de 50 ações.

Mudanças de endereço, hash e histórico de aplicações SPA são detectadas também durante a explicação do último clique. A página resultante fica associada à ação anterior, sem substituir a pergunta pendente. Navegações isoladas podem virar uma etapa a explicar. Navegar para outro site ainda exige retomar explicitamente antes de capturar seus campos. Trocar para outra aba não muda a aba autorizada da demonstração.

Cada clique salvo mostra uma confirmação animada junto ao ponto clicado e atualiza o rodapé. A conversa tem rolagem independente: o rascunho e a caixa de mensagem continuam acessíveis embaixo.

O assistente pode apontar um campo já registrado ao perguntar sobre ele: um cursor com o nome Assistente e uma borda acompanham o alvo por alguns segundos. O botão **Mostrar** da resposta ou do rascunho repete o destaque. Pressione **Esc** para ocultar. O cursor é apenas uma indicação visual, sem clicar, preencher ou iniciar a automação.

A referência é o identificador de um evento realmente capturado, validado localmente. A IA não fornece seletores ou coordenadas. O destaque exige a mesma aba e página, recusa alvos sensíveis ou ambíguos e respeita a preferência de redução de movimento. Recarregue as abas abertas após atualizar a extensão para ativar o novo observador.

## Dados e acesso

O observador não lê o valor dos campos. Senhas e campos reconhecidos como sensíveis são excluídos; campos personalizados sensíveis também podem ser marcados pelo site com `data-itsflow-private`. Não use essa identificação automática como garantia para demonstrar operações sensíveis.

Os seletores, endereços completos, recortes e textos ficam na sessão local da extensão; a importação os salva no Studio. Antes de importar, confira os endereços, que podem conter parâmetros da sessão. Para conversar, a extensão envia os rótulos, tipos, endereços sem query/hash, explicações e texto das mensagens, além da mensagem escrita e do contexto estrutural da automação. A análise visual anexa somente o recorte selecionado. Não transmite HTML, a tela completa nem os valores digitados na página. Evite dados confidenciais nos recortes, rótulos e mensagens.

A conversa e a análise automática de cada etapa usam a integração ChatGPT já existente no Studio e estão sujeitas aos limites dessa conta. Importar os blocos não chama a IA. A ponte local aceita pedidos somente da extensão pareada, com código e versão correspondentes.

## Verificações de desenvolvimento

- `npm run chat:build` compila o chat do Studio e o painel da extensão com o mesmo componente de esfera.
- `npm run chat:check` valida TypeScript.
- `python -m unittest tests.test_chrome_demonstration tests.test_map_paths -q` valida conversão, isolamento, revisão e importação sem duplicação.
- `node --test tests/test_chrome_demonstration.cjs` valida a captura vinculada à aba e os dados enviados ao chat.
- `node tests/test_chrome_demonstration_browser.cjs` valida o painel e ações reais de teste em Chrome, com a ponte e a resposta da IA simuladas. Aceita `PLAYWRIGHT_MODULE` para localizar Playwright.
- `cargo test --locked chrome_test_bridge::tests --lib` em `tauri_gerador/src-tauri` valida a ponte e a autenticação.
