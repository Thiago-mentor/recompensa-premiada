"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ClanEmptyState } from "@/components/cla/ClanEmptyState";
import { ClaGameHeader } from "@/components/cla/ClaGameHeader";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { useCenterScreenFeedback } from "@/components/feedback/CenterScreenFeedback";
import { Button } from "@/components/ui/Button";
import {
  ArenaShell,
  fadeUpItem,
  staggerContainer,
} from "@/components/arena/ArenaShell";
import { useClanDashboard } from "@/hooks/useClanDashboard";
import {
  resolveClanAvatarUrl,
  resolveClanCoverStyle,
  resolveClanMonogram,
} from "@/lib/clan/visuals";
import { formatClanPrivacy, formatClanTime } from "@/lib/clan/ui";
import {
  deleteClanAssetByUrl,
  uploadClanAsset,
  uploadClanCoverFromPreview,
  validateClanImageFile,
} from "@/services/clans/clanAssetService";
import { updateClanSettings, leaveClan } from "@/services/clans/clanService";
import { validatePublicName } from "@/lib/validations/publicNameModeration";
import type { ClanPrivacy } from "@/types/clan";
import { ClaSectionNav } from "../ClaSectionNav";
import { Copy, ImagePlus, LogOut, RotateCcw, Save, ShieldAlert } from "lucide-react";

const fieldClass =
  "min-h-[46px] w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-cyan-400/30";
const textareaClass =
  "min-h-[120px] w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-cyan-400/30";
const DEFAULT_COVER_POSITION = 50;
const DEFAULT_COVER_SCALE = 100;

export default function ClaConfiguracoesPage() {
  const { notify } = useCenterScreenFeedback();
  const {
    loading,
    hasClan,
    clan,
    canManageClan,
    members,
    messages,
    pendingJoinRequestsCount,
    isOwner,
  } = useClanDashboard();
  const [clanName, setClanName] = useState("");
  const [clanTag, setClanTag] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [privacy, setPrivacy] = useState<ClanPrivacy>("code_only");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverPositionX, setCoverPositionX] = useState(50);
  const [coverPositionY, setCoverPositionY] = useState(50);
  const [coverScale, setCoverScale] = useState(100);
  const [coverDraftFile, setCoverDraftFile] = useState<File | null>(null);
  const [coverDraftPreviewUrl, setCoverDraftPreviewUrl] = useState<string | null>(null);
  const [coverMarkedForReset, setCoverMarkedForReset] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<"avatar" | "cover" | null>(null);
  const [draggingCover, setDraggingCover] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const coverPreviewRef = useRef<HTMLDivElement | null>(null);
  const savedAvatarUrlRef = useRef<string | null>(null);
  const savedCoverUrlRef = useRef<string | null>(null);
  const savedCoverPositionXRef = useRef(DEFAULT_COVER_POSITION);
  const savedCoverPositionYRef = useRef(DEFAULT_COVER_POSITION);
  const savedCoverScaleRef = useRef(DEFAULT_COVER_SCALE);
  const coverDraftObjectUrlRef = useRef<string | null>(null);

  const isSoloFounder = Boolean(isOwner && members.length === 1);
  const [dissolvingClan, setDissolvingClan] = useState(false);

  const recentGrowthCount = useMemo(() => {
    const threshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return members.filter((member) => {
      const joinedAt = member.joinedAt;
      if (!joinedAt || typeof joinedAt !== "object" || !("toMillis" in joinedAt)) return false;
      try {
        return (joinedAt as { toMillis: () => number }).toMillis() >= threshold;
      } catch {
        return false;
      }
    }).length;
  }, [members]);
  const systemHistory = useMemo(
    () => messages.filter((item) => item.kind === "system").slice(-8).reverse(),
    [messages],
  );

  function clearDraftCoverPreview() {
    if (coverDraftObjectUrlRef.current) {
      URL.revokeObjectURL(coverDraftObjectUrlRef.current);
      coverDraftObjectUrlRef.current = null;
    }
  }

  function resetCoverFrame() {
    setCoverPositionX(DEFAULT_COVER_POSITION);
    setCoverPositionY(DEFAULT_COVER_POSITION);
    setCoverScale(DEFAULT_COVER_SCALE);
  }

  function getActiveCoverPreviewUrl() {
    return coverMarkedForReset ? null : coverDraftPreviewUrl ?? coverUrl;
  }

  useEffect(() => {
    return () => {
      clearDraftCoverPreview();
    };
  }, []);

  useEffect(() => {
    if (!clan) return;
    clearDraftCoverPreview();
    setClanName(clan.name);
    setClanTag(clan.tag);
    setInviteCode(clan.inviteCode || "");
    setPrivacy(clan.privacy);
    setDescription(clan.description || "");
    setAvatarUrl(clan.avatarUrl ?? null);
    setCoverUrl(clan.coverUrl ?? null);
    setCoverPositionX(clan.coverPositionX);
    setCoverPositionY(clan.coverPositionY);
    setCoverScale(clan.coverScale);
    setCoverDraftFile(null);
    setCoverDraftPreviewUrl(null);
    setCoverMarkedForReset(false);
    savedAvatarUrlRef.current = clan.avatarUrl ?? null;
    savedCoverUrlRef.current = clan.coverUrl ?? null;
    savedCoverPositionXRef.current = clan.coverPositionX;
    savedCoverPositionYRef.current = clan.coverPositionY;
    savedCoverScaleRef.current = clan.coverScale;
  }, [clan]);

  async function handleSave() {
    if (!clan?.id) return;
    setSaving(true);
    const blockedMessage =
      validatePublicName(clanName) ||
      validatePublicName(clanTag) ||
      validatePublicName(description);
    if (blockedMessage) {
      notify("error", blockedMessage);
      setSaving(false);
      return;
    }
    let uploadedCoverUrl: string | null = null;
    try {
      const coverFrameChanged =
        coverPositionX !== savedCoverPositionXRef.current ||
        coverPositionY !== savedCoverPositionYRef.current ||
        coverScale !== savedCoverScaleRef.current;
      let nextCoverUrl = coverMarkedForReset ? null : coverUrl;
      let nextCoverPositionX = coverPositionX;
      let nextCoverPositionY = coverPositionY;
      let nextCoverScale = coverScale;

      if (coverMarkedForReset) {
        nextCoverPositionX = DEFAULT_COVER_POSITION;
        nextCoverPositionY = DEFAULT_COVER_POSITION;
        nextCoverScale = DEFAULT_COVER_SCALE;
      } else if (coverDraftFile || (coverUrl && coverFrameChanged)) {
        const previewRect = coverPreviewRef.current?.getBoundingClientRect();
        if (!previewRect || previewRect.width < 1 || previewRect.height < 1) {
          throw new Error("Não foi possível gerar o recorte final da capa.");
        }
        uploadedCoverUrl = await uploadClanCoverFromPreview({
          source: coverDraftFile ?? coverUrl!,
          positionX: coverPositionX,
          positionY: coverPositionY,
          scale: coverScale,
          viewportWidth: previewRect.width,
          viewportHeight: previewRect.height,
        });
        nextCoverUrl = uploadedCoverUrl;
        nextCoverPositionX = DEFAULT_COVER_POSITION;
        nextCoverPositionY = DEFAULT_COVER_POSITION;
        nextCoverScale = DEFAULT_COVER_SCALE;
      }

      await updateClanSettings({
        clanId: clan.id,
        name: clanName,
        tag: clanTag,
        inviteCode,
        description,
        privacy,
        avatarUrl,
        coverUrl: nextCoverUrl,
        coverPositionX: nextCoverPositionX,
        coverPositionY: nextCoverPositionY,
        coverScale: nextCoverScale,
      });
      savedAvatarUrlRef.current = avatarUrl;
      savedCoverUrlRef.current = nextCoverUrl;
      savedCoverPositionXRef.current = nextCoverPositionX;
      savedCoverPositionYRef.current = nextCoverPositionY;
      savedCoverScaleRef.current = nextCoverScale;
      setCoverUrl(nextCoverUrl);
      setCoverPositionX(nextCoverPositionX);
      setCoverPositionY(nextCoverPositionY);
      setCoverScale(nextCoverScale);
      clearDraftCoverPreview();
      setCoverDraftFile(null);
      setCoverDraftPreviewUrl(null);
      setCoverMarkedForReset(false);
      notify("success", "Configurações do clã atualizadas.");
    } catch (error) {
      if (uploadedCoverUrl) {
        await deleteClanAssetByUrl(uploadedCoverUrl);
      }
      notify(
        "error",
        error instanceof Error ? error.message : "Não foi possível atualizar o clã.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDissolveClan() {
    if (!isSoloFounder) return;
    if (
      !window.confirm(
        "Encerrar o clã permanentemente? O grupo será apagado, o histórico e pedidos pendentes serão removidos, e você ficará sem clã.",
      )
    ) {
      return;
    }
    setDissolvingClan(true);
    try {
      const result = await leaveClan();
      notify(
        "success",
        result.dissolved
          ? "O clã foi encerrado. Você não pertence mais a nenhum grupo."
          : "Você saiu do clã com sucesso.",
      );
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Não foi possível encerrar o clã.",
      );
    } finally {
      setDissolvingClan(false);
    }
  }

  async function handleUploadAsset(kind: "avatar" | "cover", file: File | null) {
    if (!file) return;
    setUploadingAsset(kind);
    try {
      if (kind === "cover") {
        await validateClanImageFile(file);
        clearDraftCoverPreview();
        const previewUrl = URL.createObjectURL(file);
        coverDraftObjectUrlRef.current = previewUrl;
        setCoverDraftFile(file);
        setCoverDraftPreviewUrl(previewUrl);
        setCoverMarkedForReset(false);
        resetCoverFrame();
        notify("info", "Preview da capa atualizado. Salve para publicar o recorte final.");
        return;
      }

      const previousDraftUrl = avatarUrl;
      const savedUrl = savedAvatarUrlRef.current;
      const url = await uploadClanAsset(file, kind);
      if (previousDraftUrl && previousDraftUrl !== savedUrl) {
        await deleteClanAssetByUrl(previousDraftUrl);
      }
      setAvatarUrl(url);
      notify("success", "Avatar do clã pronto. Salve para publicar.");
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Não foi possível enviar a imagem do clã.",
      );
    } finally {
      setUploadingAsset(null);
      if (kind === "avatar" && avatarInputRef.current) avatarInputRef.current.value = "";
      if (kind === "cover" && coverInputRef.current) coverInputRef.current.value = "";
    }
  }

  async function handleCopyInviteCode() {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
    notify("success", "Código do clã copiado.");
  }

  async function resetDraftAsset(kind: "avatar" | "cover") {
    if (kind === "cover") {
      clearDraftCoverPreview();
      setCoverDraftFile(null);
      setCoverDraftPreviewUrl(null);
      setCoverMarkedForReset(true);
      resetCoverFrame();
      return;
    }

    const currentUrl = avatarUrl;
    const savedUrl = savedAvatarUrlRef.current;
    if (currentUrl && currentUrl !== savedUrl) {
      await deleteClanAssetByUrl(currentUrl);
    }
    setAvatarUrl(null);
  }

  function updateCoverPositionFromPointer(clientX: number, clientY: number) {
    const node = coverPreviewRef.current;
    if (!node || !getActiveCoverPreviewUrl()) return;
    const rect = node.getBoundingClientRect();
    const nextX = ((clientX - rect.left) / Math.max(rect.width, 1)) * 100;
    const nextY = ((clientY - rect.top) / Math.max(rect.height, 1)) * 100;
    setCoverPositionX(Math.min(100, Math.max(0, Math.round(nextX))));
    setCoverPositionY(Math.min(100, Math.max(0, Math.round(nextY))));
  }

  function handleCoverPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!getActiveCoverPreviewUrl()) return;
    setDraggingCover(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    updateCoverPositionFromPointer(event.clientX, event.clientY);
  }

  function handleCoverPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingCover) return;
    updateCoverPositionFromPointer(event.clientX, event.clientY);
  }

  function handleCoverPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDraggingCover(false);
  }

  const activeCoverPreviewUrl = getActiveCoverPreviewUrl();
  const coverControlsDisabled = !activeCoverPreviewUrl;
  const assetActionsDisabled = uploadingAsset !== null || saving;

  return (
    <ArenaShell maxWidth="max-w-lg" padding="sm" hudFrame={false}>
      <motion.div className="space-y-5" variants={staggerContainer} initial="hidden" animate="show">
        <ClaGameHeader
          kicker="Comando"
          title="Configurações"
          description="Nome, tag, convite, identidade visual e permissões de líderes ficam concentrados aqui."
          accent="violet"
        />

        <ClaSectionNav />

        {loading ? (
          <motion.section variants={fadeUpItem} className="game-panel px-4 py-10 text-center text-sm text-white/55">
            Carregando configurações do clã...
          </motion.section>
        ) : !hasClan || !clan ? (
          <ClanEmptyState
            icon={ShieldAlert}
            text="As configurações ficam disponíveis quando você participa de um clã."
            ctaLabel="Abrir hub do clã"
          />
        ) : (
          <>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleUploadAsset("avatar", event.target.files?.[0] ?? null)}
            />
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleUploadAsset("cover", event.target.files?.[0] ?? null)}
            />

            <motion.section
              variants={fadeUpItem}
              className="rounded-[1.6rem] border border-violet-400/20 bg-violet-950/25 p-4"
            >
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-violet-200" aria-hidden />
                <div className="space-y-1 text-sm text-white/65">
                  <p className="font-semibold text-white">Acesso de liderança</p>
                  <p>
                    Somente fundadores e líderes podem alterar nome, tag, convite, identidade visual e regras
                    de entrada.
                  </p>
                </div>
              </div>
            </motion.section>

            <motion.section variants={fadeUpItem} className="grid gap-3 sm:grid-cols-3">
              <InfoCard label="Nome" value={clanName || clan.name} />
              <InfoCard label="TAG" value={clanTag || clan.tag} />
              <InfoCard label="Privacidade" value={formatClanPrivacy(privacy)} />
            </motion.section>

            <motion.section variants={fadeUpItem} className="grid gap-3 sm:grid-cols-3">
              <InfoCard label="Pedidos recebidos" value={String(clan.joinRequestsReceivedCount)} />
              <InfoCard label="Pedidos aprovados" value={String(clan.joinRequestsApprovedCount)} />
              <InfoCard label="Crescimento 7 dias" value={`+${recentGrowthCount}`} />
            </motion.section>

            <motion.section
              variants={fadeUpItem}
              className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-4"
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
                  Histórico do clã
                </p>
                <h2 className="mt-1 text-lg font-black text-white">Mudanças recentes</h2>
                <p className="mt-1 text-sm text-white/55">
                  Eventos importantes do clã aparecem aqui em ordem mais recente.
                </p>
              </div>

              <div className="mt-4 space-y-3">
                {systemHistory.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/45">
                    Ainda não há eventos registrados no histórico do clã.
                  </div>
                ) : (
                  systemHistory.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-white/80">{item.text}</p>
                        <span className="shrink-0 text-[11px] text-white/40">
                          {formatClanTime(item.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.section>

            <motion.section
              variants={fadeUpItem}
              className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-4"
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
                  Identidade visual
                </p>
                <h2 className="mt-1 text-lg font-black text-white">Avatar, capa e enquadramento</h2>
                <p className="mt-1 text-sm text-white/55">
                  Personalize a aparência pública do clã na vitrine, no ranking e no perfil público.
                </p>
              </div>

              <div
                ref={coverPreviewRef}
                className={`mt-4 overflow-hidden rounded-[1.5rem] border bg-slate-950/80 ${
                  activeCoverPreviewUrl ? "cursor-grab active:cursor-grabbing" : ""
                }`}
                style={resolveClanCoverStyle({
                  id: clan.id,
                  name: clanName || clan.name,
                  tag: clanTag || clan.tag,
                  coverUrl: activeCoverPreviewUrl,
                  coverPositionX,
                  coverPositionY,
                  coverScale,
                })}
                onPointerDown={handleCoverPointerDown}
                onPointerMove={handleCoverPointerMove}
                onPointerUp={handleCoverPointerEnd}
                onPointerCancel={handleCoverPointerEnd}
              >
                <div className="bg-gradient-to-b from-transparent via-slate-950/35 to-slate-950/85 p-4">
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      <div
                        className="h-20 w-20 rounded-[26px] border border-white/10 bg-cover bg-center shadow-[0_0_32px_-16px_rgba(34,211,238,0.45)]"
                        style={{
                          backgroundImage: `url("${resolveClanAvatarUrl({
                            id: clan.id,
                            name: clanName || clan.name,
                            tag: clanTag || clan.tag,
                            avatarUrl,
                          })}")`,
                        }}
                      />
                      <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-slate-950/85 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/80">
                        {resolveClanMonogram({
                          tag: clanTag || clan.tag,
                          name: clanName || clan.name,
                        })}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200/75">
                        Preview
                      </p>
                      <p className="mt-1 text-lg font-black text-white">{clanName || clan.name}</p>
                      <p className="mt-1 text-sm text-white/60">
                        {description || "Sem descrição ainda."}
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        Código atual: {inviteCode || "—"} · Pendentes: {pendingJoinRequestsCount}
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        {activeCoverPreviewUrl
                          ? "Arraste a capa no preview para reposicionar. Ao salvar, o recorte final será publicado."
                          : "Envie uma capa para liberar o reposicionamento por arraste."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {canManageClan ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm font-semibold text-white">Avatar do clã</p>
                    <p className="mt-1 text-xs text-white/50">
                      Ícone principal exibido no hub e no perfil público.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={assetActionsDisabled}
                      >
                        <ImagePlus className="h-4 w-4" />
                        {uploadingAsset === "avatar" ? "Enviando..." : "Trocar avatar"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => void resetDraftAsset("avatar")}
                        disabled={assetActionsDisabled}
                      >
                        <RotateCcw className="h-4 w-4" />
                        Usar visual gerado
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm font-semibold text-white">Capa do clã</p>
                    <p className="mt-1 text-xs text-white/50">
                      Fundo do perfil público, ranking e cards principais.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => coverInputRef.current?.click()}
                        disabled={assetActionsDisabled}
                      >
                        <ImagePlus className="h-4 w-4" />
                        {uploadingAsset === "cover" ? "Preparando..." : "Trocar capa"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => void resetDraftAsset("cover")}
                        disabled={assetActionsDisabled}
                      >
                        <RotateCcw className="h-4 w-4" />
                        Usar visual gerado
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </motion.section>

            <motion.section
              variants={fadeUpItem}
              className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
                    Código de convite
                  </p>
                  <p className="mt-1 text-xl font-black tracking-[0.22em] text-white">
                    {inviteCode || "—"}
                  </p>
                </div>
                <Button variant="secondary" onClick={() => void handleCopyInviteCode()}>
                  <Copy className="h-4 w-4" />
                  Copiar código
                </Button>
              </div>
            </motion.section>

            {canManageClan ? (
              <>
                <motion.section
                  variants={fadeUpItem}
                  className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-4"
                >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
                    Ajustes editáveis
                  </p>
                  <h2 className="mt-1 text-lg font-black text-white">Identidade, convite e capa</h2>
                </div>

                <div className="mt-4 space-y-3">
                  <input
                    value={clanName}
                    onChange={(event) => setClanName(event.target.value.slice(0, 24))}
                    className={fieldClass}
                    placeholder="Nome do clã"
                  />
                  <input
                    value={clanTag}
                    onChange={(event) =>
                      setClanTag(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))
                    }
                    className={fieldClass}
                    placeholder="TAG"
                  />
                  <input
                    value={inviteCode}
                    onChange={(event) =>
                      setInviteCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))
                    }
                    className={fieldClass}
                    placeholder="Código do clã"
                  />
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className={textareaClass}
                    placeholder="Descrição do clã"
                  />

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">Enquadramento da capa</p>
                        <p className="mt-1 text-xs text-white/50">
                          Ajuste a posição e o zoom da capa. O arquivo final será gerado a partir desse preview.
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold text-white/45">
                        X {coverPositionX}% · Y {coverPositionY}% · Zoom {coverScale}%
                      </span>
                    </div>
                    <div className="mt-4 space-y-4">
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                          Horizontal
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={coverPositionX}
                          onChange={(event) => setCoverPositionX(Number(event.target.value))}
                          className="mt-2 w-full accent-cyan-400"
                          disabled={coverControlsDisabled}
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                          Vertical
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={coverPositionY}
                          onChange={(event) => setCoverPositionY(Number(event.target.value))}
                          className="mt-2 w-full accent-fuchsia-400"
                          disabled={coverControlsDisabled}
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                          Zoom
                        </span>
                        <input
                          type="range"
                          min={100}
                          max={220}
                          value={coverScale}
                          onChange={(event) => setCoverScale(Number(event.target.value))}
                          className="mt-2 w-full accent-amber-400"
                          disabled={coverControlsDisabled}
                        />
                      </label>
                    </div>
                  </div>

                  <select
                    value={privacy}
                    onChange={(event) =>
                      setPrivacy(event.target.value === "open" ? "open" : "code_only")
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
                </div>

                <div className="mt-4 flex justify-end">
                  <Button variant="arena" onClick={() => void handleSave()} disabled={saving || uploadingAsset !== null}>
                    <Save className="h-4 w-4" />
                    {saving ? "Salvando..." : "Salvar mudanças"}
                  </Button>
                </div>
              </motion.section>

              {isSoloFounder ? (
                <motion.section
                  variants={fadeUpItem}
                  className="rounded-[1.6rem] border border-rose-400/25 bg-rose-950/20 p-4 shadow-[0_0_36px_-16px_rgba(244,63,94,0.2)]"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-200/75">
                        Zona sensível
                      </p>
                      <h2 className="mt-1 text-lg font-black text-white">Encerrar clã</h2>
                      <p className="mt-1 max-w-xl text-sm text-white/60">
                        Você é o único membro. Encerrar remove o grupo, histórico e pedidos — a ação não pode ser
                        desfeita.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      className="shrink-0 border-rose-400/35 bg-rose-500/10 text-rose-50 hover:border-rose-400/50 hover:bg-rose-500/18"
                      onClick={() => void handleDissolveClan()}
                      disabled={dissolvingClan || saving || uploadingAsset !== null}
                    >
                      <LogOut className="h-4 w-4" />
                      {dissolvingClan ? "Encerrando..." : "Encerrar clã"}
                    </Button>
                  </div>
                </motion.section>
              ) : null}
              </>
            ) : (
              <AlertBanner tone="info">
                Você pode consultar o código e a descrição atual, mas não tem permissão para editar este clã.
              </AlertBanner>
            )}
          </>
        )}
      </motion.div>
    </ArenaShell>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
