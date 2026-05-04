"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClanAccessBadge } from "@/components/cla/ClanAccessBadge";
import { ClaGameHeader } from "@/components/cla/ClaGameHeader";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useClanDashboard } from "@/hooks/useClanDashboard";
import {
  resolveClanAvatarUrl,
  resolveClanCoverStyle,
  resolveClanMonogram,
} from "@/lib/clan/visuals";
import {
  formatClanJoinRequestStatus,
  formatClanPrivacy,
  formatClanRole,
  formatClanTime,
  resolveClanWeeklyBreakdown,
  resolveClanWeeklyScore,
} from "@/lib/clan/ui";
import { ROUTES, routeClaPublico } from "@/lib/constants/routes";
import { resolveAvatarUrl } from "@/lib/users/avatar";
import {
  cancelClanJoinRequest,
  createClan,
  joinClanByCode,
  requestClanAccess,
  subscribeDiscoverableClans,
} from "@/services/clans/clanService";
import { validatePublicName } from "@/lib/validations/publicNameModeration";
import type { Clan as ClanRecord, ClanPrivacy } from "@/types/clan";
import {
  ArenaShell,
  fadeUpItem,
  staggerContainer,
  staggerItem,
} from "@/components/arena/ArenaShell";
import { ClaSectionNav } from "./ClaSectionNav";
import {
  ArrowUpDown,
  Crown,
  Medal,
  MessageCircle,
  Search,
  Shield,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";

const fieldClass =
  "game-input px-4 py-3 text-sm";
const textareaClass =
  "game-input min-h-[110px] px-4 py-3 text-sm";

type DiscoverClanFilter = "all" | "open" | "closed";
type DiscoverClanSort = "activity" | "members" | "slots";
type ClanRankingMode = "activity" | "members" | "points";

export function ClaHubClient() {
  const { user, profile } = useAuth();
  const {
    loading,
    hasClan,
    membership,
    clan,
    members,
    messages,
    myJoinRequest,
    hasUnreadChat,
    hasPendingJoinRequests,
    pendingJoinRequestsCount,
    canManageClan,
  } = useClanDashboard();
  const nome = profile?.nome || user?.displayName || "Jogador";
  const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const [discoverableClans, setDiscoverableClans] = useState<ClanRecord[]>([]);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogFilter, setCatalogFilter] = useState<DiscoverClanFilter>("all");
  const [catalogSort, setCatalogSort] = useState<DiscoverClanSort>("activity");
  const [rankingMode, setRankingMode] = useState<ClanRankingMode>("activity");
  const [notice, setNotice] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState<"create" | "join" | `request:${string}` | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    tag: "",
    description: "",
    privacy: "code_only" as ClanPrivacy,
  });
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeDiscoverableClans(setDiscoverableClans);
    return unsubscribe;
  }, []);

  const catalog = useMemo(
    () => {
      const queryValue = normalizeCatalogText(catalogQuery);
      return [...discoverableClans]
        .filter((item) => {
          if (catalogFilter === "open") return item.privacy === "open";
          if (catalogFilter === "closed") return item.privacy === "code_only";
          return true;
        })
        .filter((item) => {
          if (!queryValue) return true;
          return normalizeCatalogText(`${item.name} ${item.tag} ${item.description}`).includes(
            queryValue,
          );
        })
        .sort((a, b) => {
          if (catalogSort === "activity") {
            const activityDiff = clanActivityMs(b) - clanActivityMs(a);
            if (activityDiff !== 0) return activityDiff;
          }
          if (catalogSort === "members") {
            const densityA = a.maxMembers > 0 ? a.memberCount / a.maxMembers : 0;
            const densityB = b.maxMembers > 0 ? b.memberCount / b.maxMembers : 0;
            if (densityB !== densityA) return densityB - densityA;
            const memberDiff = b.memberCount - a.memberCount;
            if (memberDiff !== 0) return memberDiff;
          }
          if (catalogSort === "slots") {
            const slotsDiff = b.maxMembers - b.memberCount - (a.maxMembers - a.memberCount);
            if (slotsDiff !== 0) return slotsDiff;
          }

          const privacyDiff = a.privacy === b.privacy ? 0 : a.privacy === "open" ? -1 : 1;
          if (privacyDiff !== 0) return privacyDiff;
          return a.name.localeCompare(b.name, "pt-BR");
        });
    },
    [catalogFilter, catalogQuery, catalogSort, discoverableClans],
  );

  const totalCatalogCount = discoverableClans.length;
  const clanRanking = useMemo(
    () =>
      [...discoverableClans]
        .sort((a, b) =>
          rankingMode === "activity"
            ? clanActivityMs(b) - clanActivityMs(a)
            : rankingMode === "points"
              ? compareClanWeeklyScore(b, a) || clanActivityMs(b) - clanActivityMs(a)
              : b.memberCount - a.memberCount || clanActivityMs(b) - clanActivityMs(a),
        )
        .slice(0, 5),
    [discoverableClans, rankingMode],
  );

  async function handleCreateClan() {
    setBusy("create");
    setNotice(null);
    const blockedMessage =
      validatePublicName(createForm.name) ||
      validatePublicName(createForm.tag) ||
      validatePublicName(createForm.description);
    if (blockedMessage) {
      setNotice({ tone: "error", text: blockedMessage });
      setBusy(null);
      return;
    }
    try {
      await createClan(createForm);
      setCreateForm({
        name: "",
        tag: "",
        description: "",
        privacy: "code_only",
      });
      setNotice({ tone: "success", text: "Clã criado com sucesso. Seu lobby social já está ativo." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Não foi possível criar o clã.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleJoinClan() {
    setBusy("join");
    setNotice(null);
    try {
      const result = await joinClanByCode({ code: joinCode });
      setJoinCode("");
      setNotice({
        tone: "success",
        text:
          result.status === "pending"
            ? "Solicitação enviada. Aguarde a aprovação da liderança do clã."
            : "Entrada no clã confirmada. Bem-vindo ao time.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Não foi possível entrar no clã.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleCancelJoinRequest() {
    setBusy("join");
    setNotice(null);
    try {
      await cancelClanJoinRequest();
      setNotice({ tone: "success", text: "Solicitação de entrada cancelada." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Não foi possível cancelar a solicitação.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleRequestClanAccess(item: ClanRecord) {
    setBusy(`request:${item.id}`);
    setNotice(null);
    try {
      const result = await requestClanAccess({ clanId: item.id });
      setNotice({
        tone: "success",
        text:
          result.status === "pending"
            ? `Pedido enviado para ${item.name}. Aguarde a aprovação da liderança.`
            : `Entrada no clã ${item.name} confirmada.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Não foi possível solicitar entrada no clã.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <ArenaShell maxWidth="max-w-lg" padding="sm" hudFrame={false}>
      <motion.div
        className="space-y-5"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <ClaGameHeader
          kicker="Lobby social"
          title="Clã"
          description="Organize o esquadrão, acompanhe atividade e fale com o time sem sair da arena."
          accent="fuchsia"
        />

        <ClaSectionNav />

        {notice ? <AlertBanner tone={notice.tone}>{notice.text}</AlertBanner> : null}

        {loading ? (
          <motion.section
            variants={fadeUpItem}
            className="game-panel px-4 py-10 text-center text-sm text-white/55"
          >
            Carregando estado do seu clã...
          </motion.section>
        ) : hasClan && clan ? (
          <>
            <motion.section
              variants={fadeUpItem}
              className="relative game-panel overflow-hidden border-violet-400/20 p-4 shadow-[0_0_48px_-20px_rgba(139,92,246,0.35)]"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-14 -top-20 h-40 w-40 rotate-12 bg-gradient-to-br from-cyan-400/30 via-fuchsia-500/15 to-transparent blur-2xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-violet-500/20 blur-3xl"
              />
              <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0 sm:flex-1">
                  <p className="game-kicker">
                    Seu clã ativo
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black text-white sm:text-2xl">{clan.name}</h2>
                    <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-fuchsia-100">
                      {clan.tag}
                    </span>
                  </div>
                  <p className="mt-2 max-w-xl text-sm text-white/60">
                    {clan.description || "Sem descrição. Abra as configs para definir a identidade do esquadrão."}
                  </p>
                </div>
                <span className="game-chip w-fit shrink-0 sm:mt-0.5">
                  {formatClanRole(membership?.role)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <ClanMetric label="Membros" value={`${clan.memberCount}/${clan.maxMembers}`} />
                <ClanMetric label="Entrada" value={formatClanPrivacy(clan.privacy)} />
                <ClanMetric label="Pontos semana" value={`${resolveClanWeeklyScore(clan)} pts`} />
                <ClanMetric label="Código" value={clan.inviteCode || "—"} />
                <ClanMetric label="Acesso" value={canManageClan ? "Liderança" : "Padrão"} />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {members.slice(0, 4).map((member) => (
                  <div
                    key={member.uid}
                    aria-label={member.nome}
                    className="h-11 w-11 rounded-2xl border border-white/10 bg-cover bg-center shadow-[0_0_24px_-12px_rgba(34,211,238,0.4)]"
                    style={{
                      backgroundImage: `url("${resolveAvatarUrl({
                        photoUrl: member.foto,
                        name: member.nome,
                        username: member.username,
                        uid: member.uid,
                      })}")`,
                    }}
                  />
                ))}
                <span className="text-xs text-white/45">
                  {members.length > 0
                    ? `${members.length} membro${members.length > 1 ? "s" : ""} carregado${members.length > 1 ? "s" : ""}`
                    : "Nenhum membro carregado ainda."}
                </span>
              </div>
            </motion.section>

            <motion.div
              variants={staggerContainer}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
            >
              <motion.div variants={staggerItem}>
                <Link
                  href={ROUTES.claMembros}
                  className="game-panel-soft flex h-full min-h-[96px] flex-col justify-between rounded-2xl border-cyan-400/15 p-3 transition hover:border-cyan-400/25 sm:min-h-[120px] sm:p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Users className="h-5 w-5 text-cyan-200" />
                    {hasPendingJoinRequests ? (
                      <ClanAccessBadge
                        label={
                          pendingJoinRequestsCount === 1
                            ? "1 pedido"
                            : `${pendingJoinRequestsCount} pedidos`
                        }
                        tone="amber"
                      />
                    ) : null}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Membros</p>
                    <p className="mt-1 line-clamp-2 text-xs text-white/55">Papéis, presença e formação do esquadrão.</p>
                  </div>
                </Link>
              </motion.div>
              <motion.div variants={staggerItem}>
                <Link
                  href={ROUTES.claChat}
                  className="game-panel-soft flex h-full min-h-[96px] flex-col justify-between rounded-2xl border-fuchsia-400/15 p-3 transition hover:border-fuchsia-400/25 sm:min-h-[120px] sm:p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <MessageCircle className="h-5 w-5 text-fuchsia-200" />
                    {hasUnreadChat ? <ClanAccessBadge label="Novo chat" tone="fuchsia" /> : null}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Chat</p>
                    <p className="mt-1 line-clamp-2 text-xs text-white/55">Chat rápido para combinar rota e celebrar vitórias.</p>
                  </div>
                </Link>
              </motion.div>
              <motion.div variants={staggerItem}>
                <Link
                  href={ROUTES.claConfiguracoes}
                  className="game-panel-soft flex h-full min-h-[96px] flex-col justify-between rounded-2xl border-violet-400/15 p-3 transition hover:border-violet-400/25 sm:min-h-[120px] sm:p-4"
                >
                  <Shield className="h-5 w-5 text-violet-200" />
                  <div>
                    <p className="text-sm font-bold text-white">Configurações</p>
                    <p className="mt-1 text-xs text-white/55">
                      Identidade, privacidade e código do esquadrão.
                    </p>
                  </div>
                </Link>
              </motion.div>
            </motion.div>

            <motion.section
              variants={fadeUpItem}
              className="game-panel p-4"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="game-kicker">
                    Ranking de clãs
                  </p>
                  <h2 className="mt-1 text-lg font-black text-white">Quem está se destacando</h2>
                  <p className="mt-1 text-sm text-white/55">
                    Veja quais clãs estão quentes antes de escolher o seu time.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: "activity" as const, label: "Atividade" },
                      { id: "points" as const, label: "Pontos" },
                      { id: "members" as const, label: "Membros" },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setRankingMode(item.id)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                        rankingMode === item.id
                          ? "border-fuchsia-400/40 bg-fuchsia-500/15 text-white"
                          : "border-white/10 bg-black/20 text-white/55 hover:bg-white/[0.04] hover:text-white/80"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {clanRanking.length === 0 ? (
                <div className="game-panel-soft rounded-2xl border-dashed px-4 py-8 text-center text-sm text-white/45">
                  Ainda não há clãs suficientes para montar o ranking.
                </div>
              ) : (
                <div className="space-y-3">
                  {clanRanking.map((item, index) => (
                    <Link
                      key={`ranking-${item.id}`}
                      href={routeClaPublico(item.id)}
                      className="game-panel-soft flex items-center gap-3 rounded-2xl p-3 transition hover:border-fuchsia-400/25"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
                        <span
                          className={`text-sm font-black ${
                            index === 0
                              ? "text-amber-200"
                              : index === 1
                                ? "text-slate-200"
                                : index === 2
                                  ? "text-orange-200"
                                  : "text-white/75"
                          }`}
                        >
                          {index < 3 ? <Medal className="h-4 w-4" /> : `#${index + 1}`}
                        </span>
                      </div>
                      <div
                        className="h-12 w-12 shrink-0 rounded-2xl border border-white/10 bg-cover bg-center"
                        style={{ backgroundImage: `url("${resolveClanAvatarUrl(item)}")` }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-white">{item.name}</p>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/65">
                            {item.tag}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-white/45">
                          {formatClanRankingSummary(item, rankingMode)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </motion.section>

            <motion.section
              variants={fadeUpItem}
              className="game-panel p-4"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <MessageCircle className="h-5 w-5 text-white/75" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
                    Atividade recente
                  </p>
                  {latestMessage ? (
                    <>
                      <p className="mt-1 text-sm font-semibold text-white">{latestMessage.authorName}</p>
                      <p className="mt-1 text-sm text-white/60">{latestMessage.text}</p>
                      <p className="mt-2 text-xs text-white/40">
                        {formatClanTime(latestMessage.createdAt)}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-white/55">
                      Ainda sem mensagens. Abra o chat e puxe o primeiro chamado.
                    </p>
                  )}
                </div>
              </div>
            </motion.section>
          </>
        ) : (
          <>
            {myJoinRequest?.status === "pending" ? (
              <motion.section
                variants={fadeUpItem}
              className="game-panel border-amber-400/20 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="game-kicker text-amber-100/75">
                      Solicitação enviada
                    </p>
                    <h2 className="mt-1 text-lg font-black text-white">
                      {myJoinRequest.clanName} <span className="text-amber-100/75">[{myJoinRequest.clanTag}]</span>
                    </h2>
                    <p className="mt-1 text-sm text-white/60">
                      Status: {formatClanJoinRequestStatus(myJoinRequest.status)}. A liderança precisa aprovar sua entrada.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => void handleCancelJoinRequest()}
                    disabled={busy !== null}
                  >
                    {busy === "join" ? "Cancelando..." : "Cancelar pedido"}
                  </Button>
                </div>
              </motion.section>
            ) : null}

            <motion.section
              variants={fadeUpItem}
            className="game-panel overflow-hidden border-violet-400/20 p-4 shadow-[0_0_48px_-20px_rgba(139,92,246,0.35)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="game-kicker">
                    Sua posição agora
                  </p>
                  <p className="mt-1 text-lg font-black text-white">{nome}</p>
                  <p className="mt-1 text-sm text-white/55">
                    Você ainda está solo. Abra seu lobby ou entre com um código.
                  </p>
                </div>
                <span className="game-chip border-amber-400/25 bg-amber-500/10 text-amber-100/85">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  pronto para ativar
                </span>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <PreviewCard
                  icon={Users}
                  label="Membros"
                  text="Monte seu grupo e acompanhe quem realmente joga."
                />
                <PreviewCard
                  icon={MessageCircle}
                  label="Chat"
                  text="Combine partidas e registre o que rolou na temporada."
                />
                <PreviewCard
                  icon={Shield}
                  label="Regras"
                  text="Privacidade, entrada por código e organização do clã."
                />
              </div>
            </motion.section>

            <motion.div variants={staggerContainer} className="grid gap-4 lg:grid-cols-2">
              <motion.section
                variants={staggerItem}
                className="game-panel border-cyan-400/20 p-4"
              >
                <p className="game-kicker text-cyan-100/75">Criar clã</p>
                <h2 className="mt-1 text-lg font-black text-white">Abra seu próprio lobby</h2>
                <p className="mt-1 text-sm text-white/60">Defina nome, tag e a porta de entrada do time.</p>
                <div className="mt-4 space-y-3">
                  <input
                    value={createForm.name}
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, name: event.target.value }))
                    }
                    className={fieldClass}
                    placeholder="Nome do clã"
                  />
                  <input
                    value={createForm.tag}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        tag: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6),
                      }))
                    }
                    className={fieldClass}
                    placeholder="TAG"
                  />
                  <textarea
                    value={createForm.description}
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, description: event.target.value }))
                    }
                    className={textareaClass}
                    placeholder="Descrição curta do clã"
                  />
                  <select
                    value={createForm.privacy}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        privacy: event.target.value === "open" ? "open" : "code_only",
                      }))
                    }
                    className={fieldClass}
                  >
                    <option value="code_only" className="bg-slate-950">
                      Somente por código
                    </option>
                    <option value="open" className="bg-slate-950">
                      Aberto
                    </option>
                  </select>
                  <Button
                    variant="arena"
                    size="lg"
                    className="w-full"
                    onClick={() => void handleCreateClan()}
                    disabled={busy !== null}
                  >
                    <UserPlus className="h-4 w-4" />
                    {busy === "create" ? "Criando..." : "Criar clã"}
                  </Button>
                </div>
              </motion.section>

              <motion.section
                variants={staggerItem}
                className="game-panel border-fuchsia-400/20 p-4"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-100/75">
                  Entrar no time
                </p>
                <h2 className="mt-1 text-lg font-black text-white">Use um código de convite</h2>
                <p className="mt-1 text-sm text-white/60">Se o esquadrão já existe, o código te coloca na rota.</p>
                <div className="mt-4 space-y-3">
                  <input
                    value={joinCode}
                    onChange={(event) =>
                      setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))
                    }
                    className={fieldClass}
                    placeholder="Código do clã"
                  />
                  <div className="game-panel-soft rounded-2xl px-4 py-4 text-sm text-white/60">
                    Aberto entra na hora. Privado envia pedido para a liderança.
                  </div>
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={() => void handleJoinClan()}
                    disabled={busy !== null}
                  >
                    <Crown className="h-4 w-4" />
                    {busy === "join" ? "Entrando..." : "Entrar com código"}
                  </Button>
                </div>
              </motion.section>
            </motion.div>

            <motion.section
              variants={fadeUpItem}
              className="game-panel p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
                    Clãs disponíveis
                  </p>
                  <h2 className="mt-1 text-lg font-black text-white">Veja quem já está no ar</h2>
                  <p className="mt-1 text-sm text-white/55">
                    Clãs abertos entram direto. Clãs fechados enviam um pedido para a liderança.
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white/65">
                  {catalog.length} de {totalCatalogCount} clã{totalCatalogCount === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px]">
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                    <input
                      value={catalogQuery}
                      onChange={(event) => setCatalogQuery(event.target.value)}
                      className="game-input w-full py-3 pl-10 pr-4 text-sm"
                      placeholder="Buscar por nome, tag ou descrição"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { id: "all" as const, label: "Todos" },
                        { id: "open" as const, label: "Abertos" },
                        { id: "closed" as const, label: "Fechados" },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCatalogFilter(item.id)}
                        className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                          catalogFilter === item.id
                            ? "border-cyan-400/40 bg-cyan-500/15 text-white"
                            : "border-transparent bg-white/5 text-white/55 hover:bg-white/10 hover:text-white/80"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="min-w-0">
                  <p className="mb-2 pl-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
                    Ordenar por
                  </p>
                  <div className="relative">
                    <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                    <select
                      value={catalogSort}
                      onChange={(event) => setCatalogSort(event.target.value as DiscoverClanSort)}
                      className="game-input w-full appearance-none py-3 pl-10 pr-4 text-sm"
                    >
                      <option value="activity" className="bg-slate-950">
                        Atividade recente
                      </option>
                      <option value="members" className="bg-slate-950">
                        Lotação
                      </option>
                      <option value="slots" className="bg-slate-950">
                        Vagas livres
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {catalog.length === 0 ? (
                  <div className="game-panel-soft rounded-2xl border-dashed px-4 py-8 text-center text-sm text-white/45">
                    {catalogQuery || catalogFilter !== "all"
                      ? "Nenhum clã encontrado com esse filtro."
                      : "Nenhum clã público para listar no momento."}
                  </div>
                ) : (
                  catalog.map((item) => {
                    const isMyPendingClan = myJoinRequest?.status === "pending" && myJoinRequest.clanId === item.id;
                    const hasOtherPendingRequest =
                      myJoinRequest?.status === "pending" && myJoinRequest.clanId !== item.id;
                    const blockedByAnotherPendingRequest =
                      hasOtherPendingRequest && item.privacy !== "open";
                    const requestBusy = busy === `request:${item.id}`;

                    return (
                      <article
                        key={item.id}
                      className="game-panel-soft rounded-2xl p-4"
                      >
                        <div
                          className="overflow-hidden rounded-[1.35rem] border bg-slate-950/80"
                          style={resolveClanCoverStyle(item)}
                        >
                          <div className="bg-gradient-to-b from-transparent via-slate-950/35 to-slate-950/85 p-4">
                            <div className="flex items-start gap-3">
                              <div className="relative">
                                <div
                                  className="h-14 w-14 rounded-[20px] border border-white/10 bg-cover bg-center"
                                  style={{ backgroundImage: `url("${resolveClanAvatarUrl(item)}")` }}
                                />
                                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-slate-950/85 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-white/80">
                                  {resolveClanMonogram(item)}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-white">{item.name}</p>
                                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/70">
                                    {item.tag}
                                  </span>
                                  <ClanAccessBadge
                                    label={item.privacy === "open" ? "Aberto" : "Fechado"}
                                    tone={item.privacy === "open" ? "fuchsia" : "amber"}
                                  />
                                </div>
                                <p className="mt-2 text-sm text-white/60">
                                  {item.description || "Sem descrição pública ainda."}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                              <div className="game-panel-soft rounded-xl px-3 py-2.5">
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                                  Lotação
                                </p>
                                <p className="mt-1 text-sm font-semibold text-white">
                                  {item.memberCount}/{item.maxMembers} membros
                                </p>
                              </div>
                              <div className="game-panel-soft rounded-xl px-3 py-2.5">
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                                  Atividade
                                </p>
                                <p className="mt-1 text-sm font-semibold text-white">
                                  {formatClanCatalogActivity(item)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link
                            href={routeClaPublico(item.id)}
                            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10"
                          >
                            Ver perfil
                          </Link>
                          <div className="flex flex-wrap gap-2">
                            {isMyPendingClan ? (
                              <Button
                                variant="secondary"
                                disabled={busy !== null}
                                onClick={() => void handleCancelJoinRequest()}
                              >
                                {busy === "join" ? "Cancelando..." : "Cancelar pedido"}
                              </Button>
                            ) : (
                              <Button
                                variant={item.privacy === "open" ? "arena" : "secondary"}
                                disabled={busy !== null || blockedByAnotherPendingRequest}
                                onClick={() => void handleRequestClanAccess(item)}
                              >
                                {requestBusy
                                  ? item.privacy === "open"
                                    ? "Entrando..."
                                    : "Enviando..."
                                  : blockedByAnotherPendingRequest
                                    ? "Pedido pendente"
                                    : item.privacy === "open"
                                      ? "Entrar agora"
                                      : "Enviar pedido"}
                              </Button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </motion.section>
          </>
        )}
      </motion.div>
    </ArenaShell>
  );
}

function ClanMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="game-panel-soft rounded-2xl px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/58">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function PreviewCard({
  icon: Icon,
  label,
  text,
}: {
  icon: typeof Users;
  label: string;
  text: string;
}) {
  return (
    <div className="game-panel-soft rounded-2xl px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/58">{label}</p>
        <Icon className="h-4 w-4 text-cyan-100/75" aria-hidden />
      </div>
      <p className="mt-2 text-sm text-white/60">{text}</p>
    </div>
  );
}

function normalizeCatalogText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function timestampToMs(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value) {
    try {
      return (value as { toMillis: () => number }).toMillis();
    } catch {
      return 0;
    }
  }
  return 0;
}

function clanActivityMs(item: ClanRecord): number {
  return timestampToMs(item.lastMessageAt ?? item.updatedAt);
}

function formatClanCatalogActivity(item: ClanRecord): string {
  if (item.lastMessageAt) return `Chat às ${formatClanTime(item.lastMessageAt)}`;
  if (item.updatedAt) return `Atualizado às ${formatClanTime(item.updatedAt)}`;
  return "Sem atividade";
}

function formatClanRankingSummary(item: ClanRecord, rankingMode: ClanRankingMode): string {
  if (rankingMode === "activity") return formatClanCatalogActivity(item);
  if (rankingMode === "points") return `${resolveClanWeeklyScore(item)} pts nesta semana`;
  return `${item.memberCount}/${item.maxMembers} membros`;
}

function compareClanWeeklyScore(a: ClanRecord, b: ClanRecord): number {
  const scoreA = resolveClanWeeklyBreakdown(a);
  const scoreB = resolveClanWeeklyBreakdown(b);
  if (scoreA.score !== scoreB.score) return scoreA.score - scoreB.score;
  if (scoreA.wins !== scoreB.wins) return scoreA.wins - scoreB.wins;
  if (scoreA.ads !== scoreB.ads) return scoreA.ads - scoreB.ads;
  return a.memberCount - b.memberCount;
}
