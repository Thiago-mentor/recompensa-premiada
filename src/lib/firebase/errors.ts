import { FirebaseError } from "firebase/app";
import { firebaseEmulatorHost, firebaseEmulatorPorts, useFirebaseEmulators } from "./config";

/** Deve coincidir com a mensagem de `HttpsError` em `startChestUnlock` nas Cloud Functions. */
export const CHEST_ALREADY_OPENING_MESSAGE = "Já existe um baú em abertura.";

/** Igual ao `HttpsError` de ordem dos slots em `startChestUnlock` nas Functions. */
export const CHEST_OPEN_LOWER_SLOT_FIRST_MESSAGE =
  "Abra primeiro o baú no slot de menor número (comece pelo slot 1).";

const FUNCTION_MESSAGE_MAP: Record<string, string> = {
  "Perfil inexistente.": "Seu perfil ainda não foi carregado. Entre novamente e tente de novo.",
  "Perfil ausente.": "Seu perfil ainda não foi carregado. Tente novamente em instantes.",
  "Participante inválido.": "A partida perdeu a sincronização. Volte para a fila e tente novamente.",
  "Conta suspensa.": "Sua conta está suspensa no momento.",
  "Código de convite inválido.": "Esse código de convite não é válido.",
  "Você não pode usar o próprio código.": "Você não pode usar o seu próprio código de convite.",
  "Informe um código de convite para continuar.": "Informe um código de convite para concluir o cadastro.",
  "Limite diário de anúncios atingido.": "Você atingiu o limite diário de anúncios.",
  "Muitas partidas em sequência. Aguarde um minuto.": "Você jogou muitas partidas em sequência. Aguarde um minuto.",
  "Missão inexistente.": "Essa missão não foi encontrada.",
  "Missão não concluída.": "Essa missão ainda não foi concluída.",
  "Sistema de baús desativado.": "O sistema de baús está desativado no momento.",
  "Baú não encontrado.": "Esse baú não foi encontrado. Atualize a tela e tente de novo.",
  "Este baú ainda está na fila de espera.": "Esse baú ainda está na fila de espera.",
  [CHEST_ALREADY_OPENING_MESSAGE]: CHEST_ALREADY_OPENING_MESSAGE,
  [CHEST_OPEN_LOWER_SLOT_FIRST_MESSAGE]: CHEST_OPEN_LOWER_SLOT_FIRST_MESSAGE,
  "Este baú não está em abertura.": "Esse baú não está em abertura no momento.",
  "Este baú já atingiu o limite de anúncios.": "Esse baú já atingiu o limite de anúncios.",
  "Limite diário de aceleração de baús atingido.": "Você atingiu o limite diário de aceleração de baús.",
  "O sistema de boost está desativado no momento.": "Esse recurso está desativado no momento.",
  "Você não tem boost armazenado para ativar.": "Você não tem boost armazenado para ativar.",
  "Saldo insuficiente.": "Você não tem saldo suficiente.",
  "PR insuficientes.": "Você não tem PR suficientes.",
  "Saldo de TICKET insuficiente.": "Você não tem TICKET suficiente.",
  "Taxa de conversão inválida.": "A conversão está indisponível no momento.",
  "Indicação não encontrada.": "Essa indicação não foi encontrada.",
  "Indicação sem convidado vinculado.": "Essa indicação está sem convidado vinculado.",
  "Dados da indicação inválidos.": "Essa indicação está com dados inválidos.",
  "Usuários da indicação não encontrados.": "Não foi possível localizar os usuários dessa indicação.",
  "Jogo não suporta fila automática.": "Esse jogo não está disponível na fila automática.",
  "Jogo inválido.": "Modo de jogo inválido.",
  "Sala inexistente.": "Essa sala não existe mais.",
  "Esta sala não é PPT.": "Essa sala não pertence ao modo Pedra, Papel e Tesoura.",
  "Esta sala não é Quiz.": "Essa sala não pertence ao modo Quiz.",
  "Esta sala não é Reaction Tap.": "Essa sala não pertence ao modo Reaction Tap.",
  "Você não está nesta sala.": "Você não faz parte dessa sala.",
  "Partida já finalizada.": "Essa partida já foi encerrada.",
  "Tempo da rodada esgotado.": "O tempo da rodada acabou.",
  "Tempo da pergunta esgotado.": "O tempo da pergunta acabou.",
  "Questão da sala inválida.": "A pergunta desta sala ficou inconsistente. Tente novamente.",
  "Você já respondeu esta questão.": "Você já respondeu esta questão.",
  "Aguardando sinal da rodada.": "Aguarde o sinal da rodada para jogar.",
  "Você já reagiu nesta partida.": "Você já reagiu nesta partida.",
  "W.O. disponível só em salas PvP.": "Essa ação só está disponível em salas PvP.",
  "Você já foi pareado. Abra a sala ou aguarde o fim da partida.":
    "Você já foi pareado. Abra a sala ou aguarde o fim da partida.",
  "roomId obrigatório.": "A sala perdeu a referência. Volte e tente novamente.",
  "roomId ou jogada inválidos.": "Não foi possível enviar sua jogada. Atualize a sala e tente de novo.",
  "roomId ou resposta inválidos.": "Não foi possível enviar sua resposta. Atualize a sala e tente de novo.",
  "Token de conclusão do anúncio é obrigatório.": "Não foi possível validar o anúncio.",
  "Token de anúncio inválido.": "Não foi possível validar o anúncio.",
  "sessionId obrigatório.": "A sessão do anúncio é inválida. Tente novamente.",
  "Sessão de anúncio não encontrada.": "A sessão do anúncio expirou ou não foi encontrada.",
  "Sessão não pertence ao usuário atual.": "Essa sessão de anúncio não pertence à sua conta.",
};

function normalizeFunctionMessage(message: string): string {
  const normalized = message.trim();
  if (!normalized) return normalized;
  if (FUNCTION_MESSAGE_MAP[normalized]) return FUNCTION_MESSAGE_MAP[normalized];
  if (normalized.startsWith("Este baú ainda não está pronto.")) return normalized;
  if (
    normalized.startsWith("Você precisa de ") ||
    normalized.startsWith("Quantidade inválida.") ||
    normalized.startsWith("Dados inválidos.") ||
    normalized.startsWith("Pedido inexistente.") ||
    normalized.startsWith("Já analisado.") ||
    normalized.startsWith("Só é possível confirmar PIX")
  ) {
    return normalized;
  }
  if (normalized.includes("conversionCoinsPerGemSell")) {
    return "A troca de TICKET para PR está desativada no momento.";
  }
  if (normalized.includes("kind inválido")) {
    return "Moeda inválida para esta operação.";
  }
  if (normalized.includes("lookup deve ser username ou uid")) {
    return "Escolha um tipo de busca válido.";
  }
  return normalized;
}

/**
 * Mensagens legíveis para erros do cliente Firebase (Auth, Functions, etc.).
 */
export function formatFirebaseError(e: unknown): string {
  if (e instanceof FirebaseError) {
    const { code, message } = e;

    if (code.startsWith("functions/")) {
      if (code === "functions/internal" || message.toLowerCase() === "internal") {
        if (useFirebaseEmulators) {
          const isNetworkish =
            message.toLowerCase() === "internal" || message.toLowerCase() === "unknown";
          return [
            isNetworkish
              ? "Não houve resposta do Functions emulator (o SDK costuma reportar isso como erro “interno”). Quase sempre o emulador não está rodando ou a porta 5001 não está acessível."
              : "Não foi possível concluir a chamada ao Functions emulator.",
            `Deixe um terminal aberto na pasta recompensa-premiada com: npm run emulators — espere listar Functions em ${firebaseEmulatorHost}:${firebaseEmulatorPorts.functions} e a UI em http://127.0.0.1:4000.`,
            "Em outro terminal: npm run dev. Confirme NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true e reinicie o dev server após alterar o .env.",
            "Se o build das functions falhar no início do emulators, corrija os erros do TypeScript em functions/ antes de testar a fila.",
            "Se o terminal mostrar port taken em 9099/8080/9199/5001, já existe outro `npm run emulators` (ou processo) usando a porta — feche essa janela ou mate o PID (PowerShell: netstat -ano | findstr :9099).",
          ].join(" ");
        }
        return [
          "O servidor (Cloud Function) respondeu com erro interno.",
          "Isso costuma acontecer quando as Functions ainda não foram publicadas neste projeto, o Firestore não foi ativado, ou a região não bate com a do .env.local.",
          "→ No PowerShell, na pasta recompensa-premiada: firebase deploy --only functions",
          "→ Confira se NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION no .env.local / App Hosting é a região do deploy (neste projeto: southamerica-east1).",
        ].join(" ");
      }
      if (code === "functions/not-found") {
        return "Função não encontrada. Publique as Cloud Functions: firebase deploy --only functions";
      }
      if (code === "functions/unavailable") {
        return "Cloud Functions indisponível. Tente de novo em instantes ou verifique o status no Console Firebase.";
      }
      if (code === "functions/deadline-exceeded") {
        return "Tempo esgotado ao chamar o servidor. Verifique sua conexão.";
      }
      return message ? normalizeFunctionMessage(message) : code;
    }

    if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
      return useFirebaseEmulators
        ? "E-mail ou senha incorretos no Auth emulator. Contas da produção não existem aqui — crie uma conta local com os emuladores rodando."
        : "E-mail ou senha incorretos.";
    }
    if (code === "auth/user-not-found") {
      return useFirebaseEmulators
        ? "Não há conta com este e-mail no emulator. Crie uma conta local com os emuladores ligados; login de produção não funciona neste ambiente."
        : "Não há conta com este e-mail. Use Criar conta.";
    }
    if (code === "auth/too-many-requests") {
      return "Muitas tentativas. Aguarde um pouco e tente de novo.";
    }

    return message || code;
  }

  if (e instanceof Error) {
    if (e.message.toLowerCase() === "internal") {
      return formatFirebaseError(
        new FirebaseError("functions/internal", "internal"),
      );
    }
    return e.message;
  }
  return "Erro desconhecido.";
}
