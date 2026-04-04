import { FirebaseError } from "firebase/app";
import { isSparkFreeTier } from "./sparkMode";
import { useFirebaseEmulators } from "./config";

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
            "Deixe um terminal aberto na pasta recompensa-premiada com: npm run emulators — espere listar Functions em 127.0.0.1:5001 e a UI em http://127.0.0.1:4000.",
            "Em outro terminal: npm run dev. Confirme NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true e reinicie o dev server após alterar o .env.",
            "Se o build das functions falhar no início do emulators, corrija os erros do TypeScript em functions/ antes de testar a fila.",
          ].join(" ");
        }
        if (isSparkFreeTier()) {
          return [
            "Uma parte do app ainda chamou Cloud Functions, mas no plano Spark gratuito elas não estão disponíveis sem upgrade (Blaze).",
            "Confirme NEXT_PUBLIC_SPARK_FREE_TIER=true no .env.local e reinicie o dev server, ou publique as Functions após ativar Blaze.",
          ].join(" ");
        }
        return [
          "O servidor (Cloud Function) respondeu com erro interno.",
          "Isso costuma acontecer quando as Functions ainda não foram publicadas neste projeto, o Firestore não foi ativado, ou a região não bate com a do .env.local.",
          "→ No PowerShell, na pasta recompensa-premiada: firebase deploy --only functions",
          "→ Confira se NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION no .env.local é a região onde as functions foram deployadas (ex.: southamerica-east1).",
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
      return message ? `${message} (${code})` : code;
    }

    if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
      return useFirebaseEmulators
        ? "E-mail ou senha incorretos no Auth emulator. Contas da produção não existem aqui — crie uma em «Criar conta» com npm run emulators rodando."
        : "E-mail ou senha incorretos.";
    }
    if (code === "auth/user-not-found") {
      return useFirebaseEmulators
        ? "Não há conta com este e-mail no emulator. Use «Criar conta» (com emuladores ligados); login de produção não funciona neste ambiente."
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
