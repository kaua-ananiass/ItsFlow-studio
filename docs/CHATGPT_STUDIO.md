# Criar com ChatGPT no Studio (uso local, beta)

Em **Chat IA → FlowDetect Chat**, clique em **Continue with ChatGPT**. O login abre o navegador oficial, solicita autorização de uso do plano e retorna para o Studio. O ícone de configurações permite selecionar um modelo, gerenciar uso e desconectar.

No campo de mensagem, **Conversar** responde dúvidas. **Criar fluxo** conduz a construção por etapas: o assistente pergunta o que falta, mostra os blocos e explica como configurar. **Gerar proposta** prepara um conjunto de blocos para adicionar de uma vez. Envie pela seta ou por Enter; Shift+Enter insere uma nova linha.

Na criação guiada, use **Criar bloco no Studio** para salvar cada etapa na seção do trabalho. Texto, URL e teclas podem ser alterados no cartão e salvos no bloco real. Para imagens/OCR e tabelas, **Configurar bloco no Studio** abre o editor completo e mantém uma orientação visível, por exemplo: abrir a tela da guia no Chrome, capturar o botão e escolher a ação desejada.

Depois de configurar, clique em **Voltar ao chat e conferir**. O assistente lê a configuração salva e aponta campos ausentes. **Campos configurados** não significa que a automação foi testada. O início da execução continua sendo uma ação sua. O assistente navega entre as áreas permitidas do Studio, mas não enxerga ou controla o Chrome automaticamente.

Thinking Orb indica a atividade e a chegada do texto; o Halftone Orb fornecido compõe a apresentação. As respostas são exibidas como mensagens com formatação e opção de copiar. **Nova conversa** abre um trabalho separado, preservando os anteriores no histórico lateral. Você pode buscar, renomear, excluir e desfazer a exclusão de uma conversa.

Mensagens, rascunhos e propostas ficam salvos neste computador, inclusive depois de fechar o Studio. Cada conversa mantém seu próprio contexto. Ao retomar um chat ligado a outra automação, use **Abrir automação** para continuar no mapa correspondente. A interface ocupa toda a área disponível e o histórico pode ser recolhido pelo ícone lateral. Os detalhes técnicos e caminhos dos componentes estão em `CHATGPT_COMPONENTES.md`.

A seção criada fica separada das etapas existentes. No mapa, revise e conecte sua entrada ao fluxo ou defina essa seção como início antes de executar. O botão **Criar com ChatGPT** no mapa também abre a integração.

Contas Plus/Pro elegíveis podem usar a autorização de plano sem cadastrar uma chave de API. Limites e acesso dependem da conta. Esta integração é destinada ao aplicativo local; distribuição comercial ou serviço hospedado exige verificar a modalidade oficial apropriada.

Se aparecer `subscription_sharing_usage_limit_exceeded`, a OpenAI confirmou um limite de uso do plano compartilhado com aplicativos. Use **Gerenciar uso no ChatGPT** para conferir o limite do FlowDetect e a disponibilidade do plano. O código pode indicar um limite específico do aplicativo; não confirma que toda a assinatura acabou e não informa, sozinho, quando o uso será liberado. A integração não repete a solicitação automaticamente nem muda para cobrança por chave de API. Uma tarefa curta também pode ser recusada se o limite já foi alcançado.

Falhas agora mostram o evento, código, parâmetro, motivo de interrupção e identificador da solicitação, quando fornecidos pela OpenAI. Uma resposta interrompida por tamanho (`max_output_tokens`) é distinguida de uma restrição de uso do plano.

## O que esta versão gera

- Reaproveita blocos mapeados na automação aberta, incluindo tabelas, reconhecimento e botões.
- Cria blocos de texto, teclas, navegação HTTP(S) e loops de tabelas.
- Mostra perguntas quando faltar um alvo ou informação necessária. Responda na descrição ou mapeie no Studio e gere novamente.
- Adiciona os blocos em uma seção separada. As rotas da proposta são lineares; não copia desvios dos blocos originais.
- Recusa propostas se o mapa tiver mudado desde a geração, referências inexistentes, código arbitrário, URLs com credenciais e loops incompletos.

O contexto enviado contém tipos/títulos dos blocos, nomes de colunas, variáveis de tabela e âncoras OCR. Na criação guiada, o plano editado também acompanha a mensagem, incluindo textos, endereços e teclas dos cartões. Não envia linhas de planilha, valores capturados ou imagens automaticamente. O texto que você escrever e os nomes/âncoras dos mapeamentos são enviados à OpenAI. Não coloque senhas na descrição.

## Assistente visual e criação de vários blocos

O modo **Mapa + conversa** usa o editor real do Studio. Em **Fazer comigo**, pedidos completos podem criar vários blocos em sequência, com perguntas essenciais feitas antes da primeira alteração. O cursor **Assistente** mostra as ações e acompanha a navegação no mapa. Veja os exemplos, limites e validação em [Assistente visual — 12/11/2026](ASSISTENTE_VISUAL_2026-11-12.md).

## Assistente Sync no desktop e no Chrome

O chat universal interpreta pedidos e perguntas sem alternar modos. Na página **Inicial**, use **Demonstrar no desktop** para abrir o Sync no notch do monitor, selecionar áreas e montar reconhecimentos, cliques, validações e preenchimentos por etapas. O painel lateral da extensão também permite demonstrar uma página autorizada. O rascunho precisa ser revisado e enviado ao mapa; isso não executa a automação.

Veja [Assistente desktop](ASSISTENTE_DESKTOP.md), [Chat universal](CHAT_UNIVERSAL_ITSFLOW.md) e [Demonstração no Chrome](CHROME_DEMONSTRACAO.md).
