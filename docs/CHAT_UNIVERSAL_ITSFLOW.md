# Chat universal do itsflow Studio

O chat tem uma entrada única, sem os seletores Conversar, Gerar proposta, Criar fluxo, Ensinar e Fazer comigo. O histórico continua acessível pelo botão lateral; contas, modelo e uso continuam nas configurações. Conversas antigas permanecem salvas.

## Comportamento

- Uma dúvida ou conversa recebe uma resposta, sem editar blocos.
- Um pedido explícito e completo de criar ou configurar usa as operações já suportadas pelo editor real e pode abrir o mapa ao lado automaticamente.
- Informações essenciais ausentes são perguntadas antes da edição. Perguntas pendentes bloqueiam toda a aplicação do lote.
- A ação `universal` usa o contexto e as validações da criação guiada: automação vinculada, seleção atual, revisão, posição, ids estáveis e campos permitidos.
- Uma mensagem posterior não reaplica o plano anterior. A última edição continua com a opção de desfazer.
- Construir o fluxo não executa a automação. Capturas, recortes e outros passos manuais continuam dependendo dos controles existentes.

## Componente e animação

`tauri_gerador/components/ui/ai-thiking-orb-and-input.tsx` adapta o renderer de partículas e as curvas do MorphOrb fornecido pelo usuário. O campo se contrai durante o processamento e retorna após a resposta. As partículas e os estados acompanham o pedido real; não há resposta demonstrativa, atraso artificial ou contador de progresso inventado.

O componente é controlado pelo chat existente, preservando mensagens longas, Shift+Enter, histórico por automação, recuperação de erros e contas. O campo tem somente brilho pulsante, sem espiral. Uma cópia visual contrai o texto enviado e percorre o caminho medido até o centro da área da conversa, onde a esfera ampliada aparece. Resumos de até três etapas reais são mostrados abaixo da esfera, com entrada discreta; são estados do pedido e do editor, não raciocínio interno do modelo.

Ao concluir com sucesso, a esfera muda gradualmente para verde e mostra **Concluído** por 650 ms antes de se dissolver durante 460 ms. Depois a resposta entra com fade, pequeno deslocamento e desfoque leve. Erros não ativam o verde nem a mensagem de sucesso. Esse fechamento visual não repete a operação de edição. Movimento reduzido usa transições imediatas.

As novas respostas usam `components/generated-message.tsx`: as palavras aparecem em sequência rápida após a saída da esfera, em até cerca de dois segundos, com fade leve. O Markdown é renderizado completo antes da revelação para preservar a formatação. Isso é um efeito de apresentação; o histórico e o botão Copiar mantêm a resposta completa. Conversas reabertas não repetem a animação, e movimento reduzido mostra o texto imediatamente.

O CSS fica isolado em `web/itsflow-chat.css`. A aplicação já possui React, TypeScript, estrutura `components/ui`, Tailwind e lucide-react; não exige novos pacotes. Imagens de banco de fotos não são necessárias.

As animações respeitam movimento reduzido e pausam quando ocultas. O estado ocupado é anunciado por `role=status`. O teste `scripts/check_universal_chat.cjs` usa respostas controladas, sem conta ou tokens reais, e confere conversa, perguntas, lote no editor, revisão/encadeamento, não repetição, erro e viewport compacto. As capturas ficam em `output/chat-universal`.

Recompile o frontend com `npm run chat:build` e reinicie `npm run tauri:dev` para carregar também o novo tratamento nativo da ação universal. Instalações antigas precisam de novo build para receber a funcionalidade.
