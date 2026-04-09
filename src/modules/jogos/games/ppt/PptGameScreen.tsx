"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Gamepad2, Shield, Sparkles, Swords, Trophy } from "lucide-react";
import { ArenaShell, fadeUpItem, staggerContainer, staggerItem } from "@/components/arena/ArenaShell";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { GameModeSwitcher } from "../../components/GameModeSwitcher";
import { useGameMatchFlow } from "../../hooks/useGameMatchFlow";
import { MatchResultModal } from "../../components/MatchResultModal";
import { RewardToast } from "../../components/RewardToast";
import type { Hand } from "./engine";
import { pptClientScore, randomHouseHand, resolvePptRound } from "./engine";

type LastRound = {
  user: Hand;
  house: Hand;
  resultado: "vitoria" | "derrota" | "empate";
};

const HAND_OPTIONS: {
  id: Hand;
  label: string;
  hint: string;
  accent: string;
  chip: string;
}[] = [
  {
    id: "pedra",
    label: "Pedra",
    hint: "Impacto bruto e defesa pesada.",
    accent: "from-cyan-500/35 via-sky-500/20 to-slate-950",
    chip: "border-cyan-400/30 bg-cyan-500/12 text-cyan-100",
  },
  {
    id: "papel",
    label: "Papel",
    hint: "Controle tatico para fechar a rodada.",
    accent: "from-fuchsia-500/35 via-violet-500/20 to-slate-950",
    chip: "border-fuchsia-400/30 bg-fuchsia-500/12 text-fuchsia-100",
  },
  {
    id: "tesoura",
    label: "Tesoura",
    hint: "Corte rapido para virar o duelo.",
    accent: "from-amber-400/30 via-orange-500/20 to-slate-950",
    chip: "border-amber-300/35 bg-amber-400/12 text-amber-100",
  },
];

function handLabel(hand: Hand) {
  return HAND_OPTIONS.find((option) => option.id === hand)?.label ?? hand;
}

function handAccent(hand: Hand) {
  return HAND_OPTIONS.find((option) => option.id === hand)?.accent ?? HAND_OPTIONS[0].accent;
}

function handChip(hand: Hand) {
  return HAND_OPTIONS.find((option) => option.id === hand)?.chip ?? HAND_OPTIONS[0].chip;
}

function HandGlyph({ hand, className }: { hand: Hand; className?: string }) {
  const common = cn("h-16 w-16 shrink-0 drop-shadow-[0_0_22px_rgba(255,255,255,0.12)]", className);

  if (hand === "pedra") {
    return (
      <svg viewBox="0 0 64 64" className={common} aria-hidden>
        <path
          fill="currentColor"
          d="M32 8C24 8 18 14 18 22c0 4 2 8 5 10l-4 14c-1 3 1 6 4 7h18c12 0 21-9 21-20V24c0-9-7-16-16-16-4 0-7 1-10 4-1-2-3-4-4-4z"
          opacity="0.92"
        />
      </svg>
    );
  }

  if (hand === "papel") {
    return (
      <svg viewBox="0 0 64 64" className={common} aria-hidden>
        <rect x="14" y="10" width="36" height="44" rx="8" fill="currentColor" opacity="0.9" />
        <rect x="20" y="18" width="24" height="4" rx="2" fill="rgb(15 23 42 / 0.45)" />
        <rect x="20" y="28" width="18" height="4" rx="2" fill="rgb(15 23 42 / 0.3)" />
        <rect x="20" y="38" width="20" height="4" rx="2" fill="rgb(15 23 42 / 0.3)" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 64" className={common} aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18 44 L31 22 L44 44 M26 34 L20 54 M36 34 L42 54"
        opacity="0.96"
      />
    </svg>
  );
}

function ArenaCombatCard({
  title,
  label,
  hand,
  tone,
}: {
  title: string;
  label: string;
  hand: Hand;
  tone: "player" | "house";
}) {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-4 backdrop-blur-sm">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-70",
          handAccent(hand),
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-x-4 top-0 h-px",
          tone === "player" ? "bg-cyan-300/60" : "bg-fuchsia-300/55",
        )}
      />
      <div className="relative flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.38em] text-white/45">{title}</p>
            <p className="mt-1 text-lg font-black text-white">{label}</p>
          </div>
          <div
            className={cn(
              "rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em]",
              handChip(hand),
            )}
          >
            {handLabel(hand)}
          </div>
        </div>
        <div className="flex min-h-40 items-center justify-center rounded-[1.4rem] border border-white/10 bg-slate-950/55">
          <HandGlyph
            hand={hand}
            className={cn(
              "h-24 w-24",
              tone === "player" ? "text-cyan-100" : "text-fuchsia-100",
            )}
          />
        </div>
      </div>
    </div>
  );
}

export function PptGameScreen() {
  const sessionStart = useRef<string>(new Date().toISOString());
  const { busy, modal, closeModal, submitMatch, toast, dismissToast } = useGameMatchFlow();
  const [last, setLast] = useState<LastRound | null>(null);

  const status = useMemo(() => {
    if (!last) {
      return {
        headline: "Arena pronta",
        subline: "Escolha sua jogada e abra a rodada com estilo arcade.",
        tone: "text-cyan-100",
        glow: "from-cyan-500/20 via-violet-500/10 to-transparent",
      };
    }
    if (last.resultado === "vitoria") {
      return {
        headline: "Round vencido",
        subline: "Seu golpe passou pela defesa da casa.",
        tone: "text-emerald-200",
        glow: "from-emerald-500/25 via-cyan-500/10 to-transparent",
      };
    }
    if (last.resultado === "empate") {
      return {
        headline: "Energia equilibrada",
        subline: "As duas jogadas colidiram. Tente quebrar o espelho.",
        tone: "text-amber-100",
        glow: "from-amber-400/25 via-orange-400/10 to-transparent",
      };
    }
    return {
      headline: "Contra-ataque da casa",
      subline: "A CPU leu seu movimento. Volte mais agressivo.",
      tone: "text-rose-200",
      glow: "from-rose-500/25 via-fuchsia-500/10 to-transparent",
    };
  }, [last]);

  async function play(user: Hand) {
    const house = randomHouseHand();
    const { resultado } = resolvePptRound(user, house);
    setLast({ user, house, resultado });
    await submitMatch({
      gameId: "ppt",
      resultado,
      score: pptClientScore(resultado),
      metadata: { user, house, opponent: "casa" },
      startedAt: sessionStart.current,
      uiTitle:
        resultado === "vitoria"
          ? "Vitória!"
          : resultado === "empate"
            ? "Empate"
            : "Derrota",
      uiSubtitle: `Você: ${user} · Casa: ${house}`,
    });
  }

  return (
    <ArenaShell maxWidth="max-w-6xl" padding="md">
      <motion.div
        className="relative overflow-hidden"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -left-16 top-10 h-40 w-40 rounded-full bg-cyan-500/18 blur-3xl"
            animate={{ x: [0, 26, 0], y: [0, -12, 0], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 6.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute right-0 top-20 h-52 w-52 rounded-full bg-fuchsia-500/18 blur-3xl"
            animate={{ x: [0, -22, 0], y: [0, 16, 0], opacity: [0.35, 0.65, 0.35] }}
            transition={{ duration: 7.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-amber-400/12 blur-3xl"
            animate={{ scale: [0.96, 1.08, 0.96], opacity: [0.2, 0.45, 0.2] }}
            transition={{ duration: 5.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <motion.div variants={fadeUpItem} className="relative flex flex-col gap-6">
          <GameModeSwitcher currentGameId="ppt" mode="solo" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-100">
                <Gamepad2 className="h-3.5 w-3.5" />
                Arena Arcade
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
                Pedra, papel e tesoura
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/68 sm:text-base">
                Um duelo neon contra a casa, com visual de video game, leitura imediata da rodada
                e energia de arena sci-fi.
              </p>
            </div>
            <div className="grid min-w-[18rem] gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-cyan-100">
                  <Shield className="h-4 w-4" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.28em]">
                    Modo
                  </span>
                </div>
                <p className="mt-2 text-lg font-black text-white">Arcade solo</p>
                <p className="mt-1 text-sm text-white/55">Rodada rapida contra a CPU.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-fuchsia-100">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.28em]">
                    Recompensa
                  </span>
                </div>
                <p className="mt-2 text-lg font-black text-white">Coins no servidor</p>
                <p className="mt-1 text-sm text-white/55">Resultado e score seguem validados.</p>
              </div>
            </div>
          </div>

          <motion.section
            variants={staggerItem}
            className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70 p-4 shadow-[0_0_60px_-18px_rgba(34,211,238,0.28)] sm:p-6"
          >
            <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-r", status.glow)} />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
            <div className="relative flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/45">
                    HUD da rodada
                  </p>
                  <p className={cn("mt-2 text-2xl font-black", status.tone)}>{status.headline}</p>
                  <p className="mt-1 text-sm text-white/58">{status.subline}</p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70">
                  <Swords className="h-4 w-4 text-cyan-200" />
                  {busy ? "Processando jogada..." : "Pronto para duelar"}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
                <ArenaCombatCard
                  title="Jogador 1"
                  label="Voce"
                  hand={last?.user ?? "pedra"}
                  tone="player"
                />

                <motion.div
                  className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-amber-300/30 bg-gradient-to-b from-amber-300/18 to-orange-500/14 text-center shadow-[0_0_40px_-10px_rgba(251,191,36,0.45)]"
                  animate={{ scale: [0.96, 1.05, 0.96], rotate: [0, 4, -4, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-amber-200/80">
                      VS
                    </p>
                    <p className="mt-1 text-sm font-black text-white">Arena</p>
                  </div>
                </motion.div>

                <ArenaCombatCard
                  title="CPU"
                  label="Casa"
                  hand={last?.house ?? "tesoura"}
                  tone="house"
                />
              </div>

              {last ? (
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">
                      Sua arma
                    </p>
                    <p className="mt-2 text-lg font-black text-white">{handLabel(last.user)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">
                      Defesa da casa
                    </p>
                    <p className="mt-2 text-lg font-black text-white">{handLabel(last.house)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">
                      Veredito
                    </p>
                    <p
                      className={cn(
                        "mt-2 text-lg font-black",
                        last.resultado === "vitoria" && "text-emerald-200",
                        last.resultado === "empate" && "text-amber-100",
                        last.resultado === "derrota" && "text-rose-200",
                      )}
                    >
                      {last.resultado === "vitoria"
                        ? "Voce dominou a rodada"
                        : last.resultado === "empate"
                          ? "Duelo equilibrado"
                          : "A casa virou o golpe"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-4 text-sm text-white/52">
                  A ultima rodada vai aparecer aqui com leitura rapida da sua jogada, resposta da
                  casa e resultado do duelo.
                </div>
              )}
            </div>
          </motion.section>

          <motion.section variants={staggerItem} className="relative">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/40">
                  Escolha sua arma
                </p>
                <p className="mt-2 text-lg font-black text-white sm:text-xl">
                  Toque em uma jogada para iniciar a rodada
                </p>
              </div>
              <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 sm:inline-flex">
                <Trophy className="h-4 w-4 text-amber-300" />
                {last ? "Ultimo duelo registrado" : "Nenhum duelo jogado ainda"}
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              {HAND_OPTIONS.map((option, index) => (
                <motion.div
                  key={option.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 + index * 0.08, duration: 0.35 }}
                  whileHover={{ y: -4, scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <Button
                    variant="secondary"
                    size="lg"
                    className={cn(
                      "group relative flex min-h-[15rem] w-full flex-col items-start justify-between overflow-hidden rounded-[1.8rem] border border-white/10 bg-slate-950/75 p-5 text-left shadow-[0_0_36px_-16px_rgba(34,211,238,0.25)] transition duration-300",
                      "hover:border-cyan-300/30 hover:bg-slate-950/85 hover:shadow-[0_0_44px_-14px_rgba(34,211,238,0.35)]",
                    )}
                    disabled={busy}
                    onClick={() => play(option.id)}
                  >
                    <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", option.accent)} />
                    <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent opacity-70" />
                    <div className="relative flex w-full items-start justify-between gap-4">
                      <div>
                        <div className={cn("inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em]", option.chip)}>
                          Power move
                        </div>
                        <p className="mt-4 text-2xl font-black text-white">{option.label}</p>
                        <p className="mt-2 max-w-[20rem] text-sm leading-6 text-white/68">
                          {option.hint}
                        </p>
                      </div>
                      <HandGlyph hand={option.id} className="h-20 w-20 text-white/90 transition duration-300 group-hover:scale-105" />
                    </div>
                    <div className="relative flex w-full items-center justify-between text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
                      <span>Selecionar</span>
                      <span>{busy ? "Aguarde" : "Jogar agora"}</span>
                    </div>
                  </Button>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.section
            variants={staggerItem}
            className="grid gap-3 rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-3"
          >
            <div className="rounded-2xl border border-white/8 bg-slate-950/55 p-4">
              <div className="flex items-center gap-2 text-cyan-100">
                <Gamepad2 className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-[0.28em]">Visual</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-white/65">
                Arena com brilho neon, cards de combate e leitura de duelo no centro da tela.
              </p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-slate-950/55 p-4">
              <div className="flex items-center gap-2 text-fuchsia-100">
                <Bot className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-[0.28em]">CPU</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-white/65">
                A casa aparece como adversario real, com sua propria area e resposta visual.
              </p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-slate-950/55 p-4">
              <div className="flex items-center gap-2 text-amber-100">
                <Trophy className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-[0.28em]">
                  Feedback
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-white/65">
                O resultado continua indo para o servidor, mas agora com uma experiencia muito mais
                tematica.
              </p>
            </div>
          </motion.section>
        </motion.div>
      </motion.div>

      <MatchResultModal
        open={modal.open}
        onClose={closeModal}
        result={modal.open ? modal.result : null}
        title={modal.open ? modal.title : ""}
        subtitle={modal.open ? modal.subtitle : undefined}
        rewardCoins={modal.open ? modal.rewardCoins : 0}
        boostCoins={modal.open ? modal.boostCoins : 0}
        rankingPoints={modal.open ? modal.rankingPoints : 0}
        grantedChest={modal.open ? modal.grantedChest : null}
        error={modal.open ? modal.error : null}
      />
      <RewardToast
        message={toast?.message ?? null}
        visible={!!toast}
        onDismiss={dismissToast}
      />
    </ArenaShell>
  );
}
