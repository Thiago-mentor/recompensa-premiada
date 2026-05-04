"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ClanEmptyState } from "@/components/cla/ClanEmptyState";
import { ClaGameHeader } from "@/components/cla/ClaGameHeader";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { Button } from "@/components/ui/Button";
import {
  ArenaShell,
  fadeUpItem,
  staggerContainer,
} from "@/components/arena/ArenaShell";
import { useAuth } from "@/hooks/useAuth";
import { useClanDashboard } from "@/hooks/useClanDashboard";
import { formatClanTime } from "@/lib/clan/ui";
import { resolveAvatarUrl } from "@/lib/users/avatar";
import { markClanChatRead, sendClanMessage } from "@/services/clans/clanService";
import { ClaSectionNav } from "../ClaSectionNav";
import { MessageCircle, Send } from "lucide-react";

const textareaClass =
  "min-h-[94px] w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-cyan-400/30";

export default function ClaChatPage() {
  const { user } = useAuth();
  const { loading, hasClan, clan, messages } = useClanDashboard();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (!hasClan || !clan?.id || messages.length === 0) return;
    void markClanChatRead({ clanId: clan.id });
  }, [clan?.id, hasClan, messages.length]);

  async function handleSend() {
    if (!clan?.id) return;
    setSending(true);
    setNotice(null);
    try {
      await sendClanMessage({ clanId: clan.id, text: draft });
      setDraft("");
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Não foi possível enviar a mensagem.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <ArenaShell maxWidth="max-w-lg" padding="sm" hudFrame={false}>
      <motion.div className="space-y-5" variants={staggerContainer} initial="hidden" animate="show">
        <ClaGameHeader
          kicker="Comunicação"
          title="Chat"
          description="Canal do clã para combinar jogos, avisar meta cumprida e celebrar vitórias."
          accent="fuchsia"
        />

        <ClaSectionNav />

        {notice ? <AlertBanner tone={notice.tone}>{notice.text}</AlertBanner> : null}

        {loading ? (
          <motion.section variants={fadeUpItem} className="game-panel px-4 py-10 text-center text-sm text-white/55">
            Carregando mensagens do clã...
          </motion.section>
        ) : !hasClan || !clan ? (
          <ClanEmptyState
            icon={MessageCircle}
            text="O chat do clã aparece assim que você entrar em um grupo. Crie um clã ou use um código de convite."
            ctaLabel="Abrir hub do clã"
          />
        ) : (
          <>
            <motion.section
              variants={fadeUpItem}
              className="rounded-[1.6rem] border border-fuchsia-400/20 bg-fuchsia-500/10 p-4"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-fuchsia-100/75">
                Canal ao vivo
              </p>
              <h2 className="mt-1 text-xl font-black text-white">
                {clan.name} <span className="text-fuchsia-100/75">[{clan.tag}]</span>
              </h2>
              <p className="mt-1 text-sm text-white/60">
                Mensagens em tempo real para combinar partidas, avisos e objetivos da guilda.
              </p>
            </motion.section>

            <motion.section
              variants={fadeUpItem}
              className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-3"
            >
              <div className="max-h-[50vh] space-y-3 overflow-y-auto px-1 py-1">
                {messages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-center text-sm text-white/45">
                    Ainda não há mensagens. Envie a primeira convocação do clã.
                  </div>
                ) : (
                  messages.map((message) => {
                    const isMine = message.authorUid === user?.uid && message.kind === "text";
                    if (message.kind === "system") {
                      return (
                        <div
                          key={message.id}
                          className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-center text-sm text-white/60"
                        >
                          {message.text}
                        </div>
                      );
                    }
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`flex max-w-[86%] gap-3 rounded-2xl border px-3 py-3 ${
                            isMine
                              ? "border-cyan-400/25 bg-cyan-500/10"
                              : "border-white/10 bg-black/20"
                          }`}
                        >
                          {!isMine ? (
                            <div
                              aria-label={message.authorName}
                              className="h-10 w-10 shrink-0 rounded-2xl border border-white/10 bg-cover bg-center"
                              style={{
                                backgroundImage: `url("${resolveAvatarUrl({
                                  photoUrl: message.authorPhoto,
                                  name: message.authorName,
                                  username: message.authorUsername,
                                  uid: message.authorUid || undefined,
                                })}")`,
                              }}
                            />
                          ) : null}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-white">
                                {isMine ? "Você" : message.authorName}
                              </p>
                              <span className="text-[11px] text-white/40">
                                {formatClanTime(message.createdAt)}
                              </span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">
                              {message.text}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>
            </motion.section>

            <motion.section
              variants={fadeUpItem}
              className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-4"
            >
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className={textareaClass}
                placeholder="Escreva sua mensagem para o clã"
              />
              <div className="mt-3 flex justify-end">
                <Button
                  variant="arena"
                  onClick={() => void handleSend()}
                  disabled={sending || draft.trim().length === 0}
                >
                  <Send className="h-4 w-4" />
                  {sending ? "Enviando..." : "Enviar mensagem"}
                </Button>
              </div>
            </motion.section>
          </>
        )}
      </motion.div>
    </ArenaShell>
  );
}
