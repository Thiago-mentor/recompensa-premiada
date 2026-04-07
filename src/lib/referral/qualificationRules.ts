import type {
  ReferralCampaign,
  ReferralQualificationProgress,
  ReferralQualificationRules,
  ReferralSystemConfig,
} from "@/types/referral";

export const DEFAULT_REFERRAL_QUALIFICATION_RULES: ReferralQualificationRules = {
  requireEmailVerified: false,
  requireProfileCompleted: true,
  minAdsWatched: 0,
  minMatchesPlayed: 1,
  minMissionRewardsClaimed: 0,
};

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function resolveReferralQualificationRules(
  config?: ReferralSystemConfig | null,
  campaign?: ReferralCampaign | null,
): ReferralQualificationRules {
  return campaign?.config.qualificationRules ?? config?.qualificationRules ?? DEFAULT_REFERRAL_QUALIFICATION_RULES;
}

export function buildReferralQualificationChecklist(rules: ReferralQualificationRules): string[] {
  const items: string[] = [];

  if (rules.requireProfileCompleted) {
    items.push("Complete o perfil inicial com nome e username.");
  }

  if (rules.requireEmailVerified) {
    items.push("Verifique o e-mail da conta convidada.");
  }

  if (rules.minMatchesPlayed > 0) {
    items.push(
      `A conta convidada precisa jogar ${rules.minMatchesPlayed} ${pluralize(rules.minMatchesPlayed, "partida", "partidas")}.`,
    );
  }

  if (rules.minAdsWatched > 0) {
    items.push(
      `A conta convidada precisa assistir ${rules.minAdsWatched} ${pluralize(rules.minAdsWatched, "anuncio", "anuncios")}.`,
    );
  }

  if (rules.minMissionRewardsClaimed > 0) {
    items.push(
      `A conta convidada precisa resgatar ${rules.minMissionRewardsClaimed} ${pluralize(
        rules.minMissionRewardsClaimed,
        "recompensa de missao",
        "recompensas de missao",
      )}.`,
    );
  }

  if (items.length === 0) {
    items.push("Nao ha desafio adicional configurado para validar a indicacao.");
  }

  return items;
}

export type ReferralQualificationStatusItem = {
  id: string;
  label: string;
  completed: boolean;
  current?: number | boolean;
  target?: number | boolean;
  progressText: string;
};

function buildMissingActionText(item: ReferralQualificationStatusItem): string {
  switch (item.id) {
    case "profileCompleted":
      return "completar o perfil";
    case "emailVerified":
      return "verificar o e-mail";
    case "matchesPlayed": {
      const current = typeof item.current === "number" ? item.current : 0;
      const target = typeof item.target === "number" ? item.target : 0;
      const remaining = Math.max(0, target - current);
      return `jogar ${remaining} ${pluralize(remaining, "partida", "partidas")}`;
    }
    case "adsWatched": {
      const current = typeof item.current === "number" ? item.current : 0;
      const target = typeof item.target === "number" ? item.target : 0;
      const remaining = Math.max(0, target - current);
      return `assistir ${remaining} ${pluralize(remaining, "anuncio", "anuncios")}`;
    }
    case "missionRewardsClaimed": {
      const current = typeof item.current === "number" ? item.current : 0;
      const target = typeof item.target === "number" ? item.target : 0;
      const remaining = Math.max(0, target - current);
      return `resgatar ${remaining} ${pluralize(remaining, "missao", "missoes")}`;
    }
    default:
      return item.label.toLowerCase();
  }
}

export function buildReferralQualificationStatus(
  rules: ReferralQualificationRules,
  progress?: ReferralQualificationProgress | null,
): ReferralQualificationStatusItem[] {
  const items: ReferralQualificationStatusItem[] = [];

  if (rules.requireProfileCompleted) {
    const completed = progress?.profileCompleted === true;
    items.push({
      id: "profileCompleted",
      label: "Completar perfil",
      completed,
      current: completed,
      target: true,
      progressText: completed ? "Concluido" : "Pendente",
    });
  }

  if (rules.requireEmailVerified) {
    const completed = progress?.emailVerified === true;
    items.push({
      id: "emailVerified",
      label: "Verificar e-mail",
      completed,
      current: completed,
      target: true,
      progressText: completed ? "Sim" : "Nao",
    });
  }

  if (rules.minMatchesPlayed > 0) {
    const current = progress?.matchesPlayed ?? 0;
    items.push({
      id: "matchesPlayed",
      label: `Jogar ${rules.minMatchesPlayed} ${pluralize(rules.minMatchesPlayed, "partida", "partidas")}`,
      completed: current >= rules.minMatchesPlayed,
      current,
      target: rules.minMatchesPlayed,
      progressText: `${current}/${rules.minMatchesPlayed}`,
    });
  }

  if (rules.minAdsWatched > 0) {
    const current = progress?.adsWatched ?? 0;
    items.push({
      id: "adsWatched",
      label: `Assistir ${rules.minAdsWatched} ${pluralize(rules.minAdsWatched, "anuncio", "anuncios")}`,
      completed: current >= rules.minAdsWatched,
      current,
      target: rules.minAdsWatched,
      progressText: `${current}/${rules.minAdsWatched}`,
    });
  }

  if (rules.minMissionRewardsClaimed > 0) {
    const current = progress?.missionRewardsClaimed ?? 0;
    items.push({
      id: "missionRewardsClaimed",
      label: `Resgatar ${rules.minMissionRewardsClaimed} ${pluralize(
        rules.minMissionRewardsClaimed,
        "missao",
        "missoes",
      )}`,
      completed: current >= rules.minMissionRewardsClaimed,
      current,
      target: rules.minMissionRewardsClaimed,
      progressText: `${current}/${rules.minMissionRewardsClaimed}`,
    });
  }

  if (items.length === 0) {
    items.push({
      id: "noRequirements",
      label: "Sem desafio adicional configurado",
      completed: true,
      progressText: "Liberado",
    });
  }

  return items;
}

export function summarizeReferralQualificationPending(items: ReferralQualificationStatusItem[]): string {
  const pending = items.filter((item) => !item.completed);
  if (pending.length === 0) return "Todos os requisitos foram concluidos.";
  if (pending.length === 1) return `Falta ${buildMissingActionText(pending[0])}.`;
  return `Faltam ${pending.length} requisitos para concluir.`;
}
