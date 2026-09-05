# Respostas recomendadas para o Play Console

Estas respostas refletem o comportamento atual do Rivaliza. Revalidar sempre que Firebase, AdMob, coleta de dados ou recompensas forem alterados.

## Segurança dos dados

- O app coleta ou compartilha dados obrigatórios: **Sim**
- Todos os dados são criptografados em trânsito: **Sim**
- Usuários podem solicitar exclusão: **Sim**
- URL de exclusão: `https://recompensa-premiada--premios-14238.us-east4.hosted.app/excluir-conta`

| Categoria do Play Console | Coletado | Compartilhado | Obrigatório | Finalidades principais |
| --- | --- | --- | --- | --- |
| Localização aproximada | Sim, pelo SDK de anúncios | Sim, com provedor de anúncios | Não | Publicidade, análise e prevenção de fraude |
| Nome | Sim | Não, exceto prestadores de serviço | Sim para o perfil | Funcionalidade, personalização e gestão da conta |
| Endereço de e-mail | Sim | Não, exceto prestadores de serviço | Sim | Autenticação, segurança e gestão da conta |
| Identificadores de usuário | Sim | Não, exceto prestadores de serviço | Sim | Funcionalidade, conta, antifraude e análise |
| Informações de pagamento (chave PIX) | Sim, somente ao solicitar resgate | Não | Não | Processar solicitação de benefício e conformidade |
| Histórico financeiro/virtual | Sim | Não | Sim durante o uso da carteira | Funcionalidade, auditoria e prevenção de fraude |
| Fotos | Sim, se o usuário trocar o avatar | Não | Não | Perfil e personalização |
| Mensagens no app | Sim, chat de clã | Não | Não | Funcionalidade social e segurança |
| Interações no app | Sim | Sim, métricas/anúncios | Sim | Funcionalidade, análise, publicidade e antifraude |
| Conteúdo gerado pelo usuário | Sim | Não | Não | Perfil, clãs e chat |
| Diagnóstico/desempenho | Sim | Sim, com serviços Google | Sim | Estabilidade, análise e prevenção de abuso |
| Dispositivo ou outros IDs | Sim | Sim, com AdMob/Google | Sim para anúncios | Publicidade, análise e prevenção de fraude |

Observações:

- Marcar foto, chat, chave PIX e participação social como opcionais quando o formulário permitir.
- Firebase e Google Cloud atuam como prestadores de serviço. Confirmar no formulário se a exceção de “service provider” continua aplicável à versão usada.
- Para AdMob, declarar compartilhamento de localização aproximada, atividade e identificadores é a opção conservadora e transparente.

## Anúncios

- “O app contém anúncios?”: **Sim**
- Formato atual: anúncios recompensados opcionais.
- O app usa Advertising ID: **Sim** (Google Mobile Ads SDK).
- Público infantil: **Não**.
- Configuração recomendada no AdMob: classificação máxima `T` e bloqueio das categorias sensíveis “Jogos de azar e apostas”, “Referências a sexo e sexualidade”, “Álcool” e outras incompatíveis com a classificação obtida.

## Público-alvo

- Faixa etária recomendada: **18 anos ou mais**.
- Não selecionar faixas infantis.
- O aplicativo não é direcionado a crianças.
- Justificativa: recompensas com possível benefício externo, chave PIX, anúncios, sorteios e interação entre usuários.

## Classificação etária (IARC)

- Categoria: **Jogo**.
- Violência: **Não**.
- Conteúdo sexual/nudez: **Não**.
- Linguagem ofensiva controlada pelo desenvolvedor: **Não**.
- Usuários podem interagir/comunicar: **Sim** (chat de clã e perfis).
- Conteúdo gerado por usuários: **Sim**.
- Compras digitais com dinheiro real: **Não**, no estado atual.
- Anúncios: **Sim**.
- Compartilhamento de localização precisa: **Não**.
- Simulação ou referência a jogos de azar: **Sim** — há roleta, baús aleatórios e sorteios.
- Prêmios de valor real: responder **Sim** se PIX ou outro benefício externo estiver ativo na versão enviada.

O resultado final é calculado pela IARC. Não declarar uma classificação manualmente nem omitir roleta, sorteios ou PIX.

## Alertas de publicação

1. A combinação de moeda virtual, resultados aleatórios e benefício via PIX pode ser enquadrada na política de jogos, concursos e apostas com valor real. A aprovação não é garantida sem adequar o modelo.
2. Antes da análise, publicar termos oficiais de cada promoção com elegibilidade, datas, quantidade de ganhadores, método de seleção e probabilidades quando aplicável.
3. O chat de clã é conteúdo gerado por usuário. Implementar denúncia, bloqueio e moderação antes da produção pública.
4. Criar uma conta de revisão e fornecer instruções completas na seção “Acesso ao app”.

## Fontes oficiais

- Segurança dos dados: https://support.google.com/googleplay/android-developer/answer/10787469
- Público e classificação: https://support.google.com/googleplay/android-developer/answer/9859655
- Público-alvo: https://support.google.com/googleplay/android-developer/answer/9867159
- Jogos e prêmios de valor real: https://support.google.com/googleplay/android-developer/answer/9877032
- Assets da ficha: https://support.google.com/googleplay/android-developer/answer/9866151

