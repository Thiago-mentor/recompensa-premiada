"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleOff, LayoutList, Sparkles, TriangleAlert } from "lucide-react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { getToken } from "firebase/app-check";
import { GoogleAIBackend, Schema, VertexAIBackend, getAI, getGenerativeModel } from "firebase/ai";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { getFirebaseApp, getFirebaseFirestore, initFirebaseAppCheck } from "@/lib/firebase/client";
import {
  appCheckSiteKey,
  firebaseAiAppCheckLimitedUseTokens,
  firebaseConfig,
  firebaseVertexAiLocation,
  getFirebaseAiBackend,
} from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/constants/collections";
import { useAdminSaveFeedback } from "@/components/admin/AdminSaveFeedback";
import { AlertBanner } from "@/components/feedback/AlertBanner";
import { Button } from "@/components/ui/Button";
import type { QuizQuestionDifficulty, QuizQuestionDoc } from "@/types/quiz";

type FormState = {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctIndex: string;
  weight: string;
  active: boolean;
  category: string;
  difficulty: QuizQuestionDifficulty;
};

const EMPTY_FORM: FormState = {
  question: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctIndex: "0",
  weight: "1",
  active: true,
  category: "",
  difficulty: "medio",
};

type GeneratorFormState = {
  topic: string;
  quantity: string;
  category: string;
  difficulty: QuizQuestionDifficulty;
};

const EMPTY_GENERATOR_FORM: GeneratorFormState = {
  topic: "",
  quantity: "10",
  category: "",
  difficulty: "medio",
};

type GeneratedQuizPayload = {
  questions: Array<{
    question: string;
    options: string[];
    correctIndex: number;
    category?: string;
    difficulty?: QuizQuestionDifficulty;
    weight?: number;
  }>;
};

const quizGenerationSchema = Schema.object({
  properties: {
    questions: Schema.array({
      items: Schema.object({
        properties: {
          question: Schema.string(),
          options: Schema.array({ items: Schema.string() }),
          correctIndex: Schema.number(),
          category: Schema.string(),
          difficulty: Schema.string(),
          weight: Schema.number(),
        },
      }),
    }),
  },
});

const quizSingleRegenSchema = Schema.object({
  properties: {
    question: Schema.string(),
    options: Schema.array({ items: Schema.string() }),
    correctIndex: Schema.number(),
    category: Schema.string(),
    difficulty: Schema.string(),
    weight: Schema.number(),
  },
});

type ListFilterActive = "all" | "active" | "inactive";

export default function AdminQuizPage() {
  const { notify } = useAdminSaveFeedback();
  const [rows, setRows] = useState<QuizQuestionDoc[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(() => new Set());
  const [listFilterActive, setListFilterActive] = useState<ListFilterActive>("all");
  const [listFilterDifficulty, setListFilterDifficulty] = useState<QuizQuestionDifficulty | "all">("all");
  const [listFilterCategory, setListFilterCategory] = useState<string>("all");
  const [listFilterProblemsOnly, setListFilterProblemsOnly] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [generatorForm, setGeneratorForm] = useState<GeneratorFormState>(EMPTY_GENERATOR_FORM);
  const [busy, setBusy] = useState(false);
  const [generatorBusy, setGeneratorBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkBusyKind, setBulkBusyKind] = useState<
    "activate" | "regen" | "deactivate" | "delete" | null
  >(null);
  const [listLoadError, setListLoadError] = useState<string | null>(null);

  useEffect(() => {
    const db = getFirebaseFirestore();
    const q = query(collection(db, COLLECTIONS.quizQuestions), orderBy("updatedAt", "desc"));
    return onSnapshot(
      q,
      (snap) => {
        setListLoadError(null);
        const next = snap.docs.map((item) => {
          const data = item.data() as Partial<QuizQuestionDoc>;
          return {
            id: item.id,
            question: String(data.question ?? ""),
            options: Array.isArray(data.options) ? data.options.map((x) => String(x)) : [],
            correctIndex: Number(data.correctIndex ?? 0),
            active: data.active !== false,
            weight: Number(data.weight ?? 1) || 1,
            category: typeof data.category === "string" ? data.category : null,
            difficulty:
              data.difficulty === "facil" || data.difficulty === "dificil" || data.difficulty === "medio"
                ? data.difficulty
                : "medio",
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
        });
        setRows(next);
      },
      (err) => {
        setListLoadError(err.message || "Erro ao carregar perguntas do Firestore.");
      },
    );
  }, []);

  const selectedQuestion = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId],
  );

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      const c = row.category?.trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const search = listSearch.trim().toLowerCase();
    return rows.filter((row) => {
      if (listFilterActive === "active" && !row.active) return false;
      if (listFilterActive === "inactive" && row.active) return false;
      if (listFilterDifficulty !== "all" && row.difficulty !== listFilterDifficulty) return false;
      if (listFilterCategory !== "all") {
        const cat = (row.category ?? "").trim();
        if (cat !== listFilterCategory) return false;
      }
      if (listFilterProblemsOnly && detectQuizQuestionIssues(row).length === 0) return false;
      if (search) {
        const hay = `${row.question} ${row.category ?? ""}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }, [
    rows,
    listFilterActive,
    listFilterDifficulty,
    listFilterCategory,
    listFilterProblemsOnly,
    listSearch,
  ]);

  const visibleInactiveIds = useMemo(
    () => filteredRows.filter((r) => !r.active).map((r) => r.id),
    [filteredRows],
  );
  const activeCount = useMemo(() => rows.filter((row) => row.active).length, [rows]);
  const issueCount = useMemo(
    () => rows.filter((row) => detectQuizQuestionIssues(row).length > 0).length,
    [rows],
  );

  useEffect(() => {
    if (!selectedQuestion) {
      setForm(EMPTY_FORM);
      return;
    }
    setForm({
      question: selectedQuestion.question,
      optionA: selectedQuestion.options[0] ?? "",
      optionB: selectedQuestion.options[1] ?? "",
      optionC: selectedQuestion.options[2] ?? "",
      optionD: selectedQuestion.options[3] ?? "",
      correctIndex: String(selectedQuestion.correctIndex ?? 0),
      weight: String(selectedQuestion.weight ?? 1),
      active: selectedQuestion.active,
      category: selectedQuestion.category ?? "",
      difficulty: selectedQuestion.difficulty ?? "medio",
    });
  }, [selectedQuestion]);

  const optionList = [form.optionA, form.optionB, form.optionC, form.optionD]
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  async function save() {
    const question = form.question.trim();
    const correctIndex = Number(form.correctIndex);
    if (!question || optionList.length < 2) {
      notify("error", "Preencha a pergunta e pelo menos duas opções.");
      return;
    }
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= optionList.length) {
      notify("error", "Selecione uma resposta correta válida.");
      return;
    }
    const weight = Math.max(1, Math.floor(Number(form.weight) || 1));

    setBusy(true);
    try {
      const db = getFirebaseFirestore();
      const payload = {
        question,
        options: optionList,
        correctIndex,
        weight,
        active: form.active,
        category: form.category.trim() || null,
        difficulty: form.difficulty,
        updatedAt: serverTimestamp(),
      };
      if (selectedId) {
        await setDoc(doc(db, COLLECTIONS.quizQuestions, selectedId), payload, { merge: true });
        notify("success", "Pergunta atualizada.");
      } else {
        const ref = await addDoc(collection(db, COLLECTIONS.quizQuestions), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        await setDoc(doc(db, COLLECTIONS.quizQuestions, ref.id), { id: ref.id }, { merge: true });
        setSelectedId(ref.id);
        notify("success", "Pergunta criada.");
      }
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Erro ao salvar pergunta.");
    } finally {
      setBusy(false);
    }
  }

  async function removeSelected() {
    if (!selectedId) return;
    if (!window.confirm("Excluir esta pergunta do quiz?")) return;
    setBusy(true);
    try {
      const db = getFirebaseFirestore();
      await deleteDoc(doc(db, COLLECTIONS.quizQuestions, selectedId));
      setSelectedId(null);
      setForm(EMPTY_FORM);
      notify("success", "Pergunta excluída.");
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Erro ao excluir pergunta.");
    } finally {
      setBusy(false);
    }
  }

  function toggleBulkId(id: string) {
    setBulkSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllInactiveVisible() {
    setBulkSelectedIds(new Set(visibleInactiveIds));
  }

  function clearBulkSelection() {
    setBulkSelectedIds(new Set());
  }

  async function batchActivateSelected() {
    const ids = Array.from(bulkSelectedIds).filter((id) => {
      const row = rows.find((r) => r.id === id);
      return row && !row.active;
    });
    if (ids.length === 0) {
      notify("error", "Selecione pelo menos uma pergunta inativa para aprovar.");
      return;
    }
    setBulkBusy(true);
    setBulkBusyKind("activate");
    try {
      const db = getFirebaseFirestore();
      const CHUNK = 400;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const batch = writeBatch(db);
        for (const id of slice) {
          batch.set(
            doc(db, COLLECTIONS.quizQuestions, id),
            { active: true, updatedAt: serverTimestamp() },
            { merge: true },
          );
        }
        await batch.commit();
      }
      notify("success", `${ids.length} pergunta(s) ativada(s).`);
      clearBulkSelection();
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Erro ao ativar em lote.");
    } finally {
      setBulkBusy(false);
      setBulkBusyKind(null);
    }
  }

  async function batchDeactivateSelected() {
    const ids = Array.from(bulkSelectedIds).filter((id) => {
      const row = rows.find((r) => r.id === id);
      return row && row.active;
    });
    if (ids.length === 0) {
      notify("error", "Selecione pelo menos uma pergunta ativa para inativar.");
      return;
    }
    setBulkBusy(true);
    setBulkBusyKind("deactivate");
    try {
      const db = getFirebaseFirestore();
      const CHUNK = 400;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const batch = writeBatch(db);
        for (const id of slice) {
          batch.set(
            doc(db, COLLECTIONS.quizQuestions, id),
            { active: false, updatedAt: serverTimestamp() },
            { merge: true },
          );
        }
        await batch.commit();
      }
      notify("success", `${ids.length} pergunta(s) inativada(s).`);
      clearBulkSelection();
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Erro ao inativar em lote.");
    } finally {
      setBulkBusy(false);
      setBulkBusyKind(null);
    }
  }

  async function batchDeleteSelected() {
    const ids = Array.from(bulkSelectedIds);
    if (ids.length === 0) {
      notify("error", "Selecione pelo menos uma pergunta para excluir.");
      return;
    }
    if (
      !window.confirm(
        `Excluir ${ids.length} pergunta(s) permanentemente do Firestore? Não dá para desfazer.`,
      )
    ) {
      return;
    }
    setBulkBusy(true);
    setBulkBusyKind("delete");
    try {
      const db = getFirebaseFirestore();
      const CHUNK = 400;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const batch = writeBatch(db);
        for (const id of slice) {
          batch.delete(doc(db, COLLECTIONS.quizQuestions, id));
        }
        await batch.commit();
      }
      if (selectedId && ids.includes(selectedId)) {
        setSelectedId(null);
        setForm(EMPTY_FORM);
      }
      notify("success", `${ids.length} pergunta(s) excluída(s).`);
      clearBulkSelection();
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Erro ao excluir em lote.");
    } finally {
      setBulkBusy(false);
      setBulkBusyKind(null);
    }
  }

  async function batchRegenerateSelectedWithAI() {
    const selectedRows = Array.from(bulkSelectedIds)
      .map((id) => rows.find((r) => r.id === id))
      .filter((r): r is QuizQuestionDoc => Boolean(r));
    if (selectedRows.length === 0) {
      notify("error", "Selecione pelo menos uma pergunta para regenerar.");
      return;
    }
    setBulkBusy(true);
    setBulkBusyKind("regen");
    try {
      let ok = 0;
      let fail = 0;
      for (const row of selectedRows) {
        const issues = detectQuizQuestionIssues(row);
        const issuesLine =
          issues.length > 0 ? `Problemas detectados: ${issues.join("; ")}.` : "Melhore clareza e qualidade.";
        const prompt = [
          "Reescreva esta pergunta de quiz para português do Brasil, mantendo o mesmo tema e nível.",
          issuesLine,
          "Regras: exatamente 4 opções, uma correta, correctIndex de 0 a 3, texto objetivo.",
          `Categoria sugerida: ${row.category ?? "geral"}.`,
          `Dificuldade: ${row.difficulty ?? "medio"}.`,
          "Pergunta atual (JSON):",
          JSON.stringify({
            question: row.question,
            options: row.options,
            correctIndex: row.correctIndex,
          }),
        ].join("\n");
        try {
          const raw = await generateQuizStructuredJson(prompt, quizSingleRegenSchema);
          const parsed = JSON.parse(raw) as GeneratedQuizPayload["questions"][number];
          const normalized = normalizeGeneratedQuestion(
            parsed,
            row.category ?? "",
            row.difficulty ?? "medio",
          );
          if (!normalized) {
            fail += 1;
            continue;
          }
          const db = getFirebaseFirestore();
          await setDoc(
            doc(db, COLLECTIONS.quizQuestions, row.id),
            {
              question: normalized.question,
              options: normalized.options,
              correctIndex: normalized.correctIndex,
              category: normalized.category,
              difficulty: normalized.difficulty,
              weight: normalized.weight,
              active: false,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
          ok += 1;
        } catch {
          fail += 1;
        }
      }
      notify(
        "success",
        `Regeneração concluída: ${ok} atualizada(s), ${fail} falha(s). Revisadas ficam inativas.`,
      );
    } catch (e) {
      notify("error", formatAiLogicUserPlainMessage(e, "Não foi possível regenerar com IA."));
    } finally {
      setBulkBusy(false);
      setBulkBusyKind(null);
    }
  }

  async function generateQuestionsWithAI() {
    const topic = generatorForm.topic.trim();
    const category = generatorForm.category.trim();
    const quantity = Math.min(20, Math.max(1, Number(generatorForm.quantity) || 1));
    if (!topic) {
      notify("error", "Informe um tema para gerar perguntas.");
      return;
    }

    setGeneratorBusy(true);
    try {
      const prompt = [
        "Gere perguntas para um quiz mobile em português do Brasil.",
        `Tema principal: ${topic}.`,
        `Quantidade: ${quantity}.`,
        `Categoria desejada: ${category || "geral"}.`,
        `Dificuldade: ${generatorForm.difficulty}.`,
        "Regras obrigatórias:",
        "- cada pergunta deve ter exatamente 4 opções",
        "- apenas 1 opção correta",
        "- correctIndex deve ir de 0 a 3",
        "- perguntas claras, curtas e objetivas",
        "- evitar ambiguidades, pegadinhas e respostas discutíveis",
        "- weight padrão 1, a menos que haja motivo forte para variar",
        "- retornar somente JSON válido no schema pedido",
      ].join("\n");

      const raw = await generateQuizStructuredJson(prompt, quizGenerationSchema);
      const parsed = JSON.parse(raw) as GeneratedQuizPayload;
      const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
      const normalized = questions
        .map((item) => normalizeGeneratedQuestion(item, category || generatorForm.category, generatorForm.difficulty))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      if (normalized.length === 0) {
        throw new Error("A IA não retornou perguntas válidas.");
      }

      const db = getFirebaseFirestore();
      const batch = writeBatch(db);
      for (const item of normalized) {
        const ref = doc(collection(db, COLLECTIONS.quizQuestions));
        batch.set(ref, {
          id: ref.id,
          question: item.question,
          options: item.options,
          correctIndex: item.correctIndex,
          category: item.category,
          difficulty: item.difficulty,
          weight: item.weight,
          active: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      notify(
        "success",
        `${normalized.length} perguntas geradas com IA e salvas como inativas para revisão.`,
      );
    } catch (e) {
      notify("error", formatAiLogicUserPlainMessage(e, "Não foi possível gerar perguntas com IA."));
    } finally {
      setGeneratorBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHero
        eyebrow="Quiz premium"
        title="Perguntas do Quiz"
        accent="violet"
        description="Crie, edite, ative, desative e regenere perguntas sem precisar mexer no código. O painel combina curadoria manual, filtros e fluxo assistido por IA."
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              setSelectedId(null);
              setForm(EMPTY_FORM);
            }}
          >
            Nova pergunta
          </Button>
        }
      />

      {listLoadError ? (
        <AlertBanner tone="info">
          <strong className="text-amber-200">Lista não atualizou:</strong> {listLoadError} — confira regras do
          Firestore, índices e se você não está no <strong className="text-white">emulador</strong> vendo dados de{" "}
          <strong className="text-white">produção</strong> (ou o contrário).
        </AlertBanner>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          title="Total"
          value={String(rows.length)}
          hint="Perguntas carregadas do Firestore"
          tone="cyan"
          icon={<LayoutList className="h-4 w-4" />}
        />
        <AdminMetricCard
          title="Ativas"
          value={String(activeCount)}
          hint="Disponíveis para o app"
          tone="emerald"
          icon={<Sparkles className="h-4 w-4" />}
        />
        <AdminMetricCard
          title="Inativas"
          value={String(Math.max(0, rows.length - activeCount))}
          hint="Fora da rotação atual"
          tone="slate"
          icon={<CircleOff className="h-4 w-4" />}
        />
        <AdminMetricCard
          title="Com alerta"
          value={String(issueCount)}
          hint="Perguntas com problemas detectados"
          tone="amber"
          icon={<TriangleAlert className="h-4 w-4" />}
        />
      </section>

      <section className="space-y-4 rounded-xl border border-violet-400/20 bg-violet-950/20 p-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Gerar perguntas com IA</h2>
          <p className="mt-1 text-sm text-slate-300">
            Gere um lote e revise depois. As perguntas criadas por IA entram como inativas.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Modo IA:{" "}
            {getFirebaseAiBackend() === "vertex"
              ? `Vertex AI Gemini · região ${firebaseVertexAiLocation}`
              : "Gemini Developer API"}
            {firebaseConfig.projectId ? ` · projeto ${firebaseConfig.projectId}` : ""}
            {firebaseAiAppCheckLimitedUseTokens ? " · App Check: tokens de uso limitado" : ""}
          </p>
          {!appCheckSiteKey ? (
            <p className="mt-2 text-xs text-amber-200/85">
              App Check: defina <code className="text-cyan-200">NEXT_PUBLIC_APPCHECK_SITE_KEY</code>{" "}
              (reCAPTCHA Enterprise) e registre o app em Console → App Check. Sem isso, ao{" "}
              <strong className="text-white">exigir App Check no AI Logic</strong>, a geração por IA será
              bloqueada. Em localhost use o{" "}
              <a
                className="text-cyan-200 underline underline-offset-2 hover:text-cyan-100"
                href="https://firebase.google.com/docs/app-check/web/debug-provider"
                target="_blank"
                rel="noopener noreferrer"
              >
                provedor de debug
              </a>
              .
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 lg:grid-cols-4">
          <Field
            label="Tema"
            value={generatorForm.topic}
            onChange={(value) => setGeneratorForm((current) => ({ ...current, topic: value }))}
          />
          <Field
            label="Quantidade"
            value={generatorForm.quantity}
            onChange={(value) => setGeneratorForm((current) => ({ ...current, quantity: value }))}
          />
          <Field
            label="Categoria"
            value={generatorForm.category}
            onChange={(value) => setGeneratorForm((current) => ({ ...current, category: value }))}
          />
          <SelectField
            label="Dificuldade"
            value={generatorForm.difficulty}
            onChange={(value) =>
              setGeneratorForm((current) => ({ ...current, difficulty: value as QuizQuestionDifficulty }))
            }
            options={[
              { value: "facil", label: "Fácil" },
              { value: "medio", label: "Médio" },
              { value: "dificil", label: "Difícil" },
            ]}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={() => void generateQuestionsWithAI()} disabled={generatorBusy}>
            {generatorBusy ? "Gerando..." : "Gerar com IA"}
          </Button>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <section className="rounded-xl border border-white/10 bg-slate-900/80 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-white">Perguntas</h2>
            <button
              type="button"
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5"
              onClick={() => {
                setSelectedId(null);
                setForm(EMPTY_FORM);
              }}
            >
              Nova
            </button>
          </div>

          <div className="mb-3 space-y-2 rounded-lg border border-white/5 bg-black/20 p-3">
            <p className="text-xs font-medium text-slate-400">Filtros</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Busca"
                value={listSearch}
                onChange={setListSearch}
              />
              <SelectField
                label="Status"
                value={listFilterActive}
                onChange={(v) => setListFilterActive(v as ListFilterActive)}
                options={[
                  { value: "all", label: "Todas" },
                  { value: "active", label: "Ativas" },
                  { value: "inactive", label: "Inativas" },
                ]}
              />
              <SelectField
                label="Dificuldade"
                value={listFilterDifficulty}
                onChange={(v) => setListFilterDifficulty(v as QuizQuestionDifficulty | "all")}
                options={[
                  { value: "all", label: "Todas" },
                  { value: "facil", label: "Fácil" },
                  { value: "medio", label: "Médio" },
                  { value: "dificil", label: "Difícil" },
                ]}
              />
              <SelectField
                label="Categoria"
                value={listFilterCategory}
                onChange={setListFilterCategory}
                options={[
                  { value: "all", label: "Todas" },
                  ...categoryOptions.map((c) => ({ value: c, label: c })),
                ]}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={listFilterProblemsOnly}
                onChange={(e) => setListFilterProblemsOnly(e.target.checked)}
              />
              Mostrar só com problemas (formato inválido, duplicadas, etc.)
            </label>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/15 bg-amber-950/20 p-3">
            <span className="text-sm text-amber-100/90">
              Lote: {bulkSelectedIds.size} selecionada(s)
            </span>
            <button
              type="button"
              disabled={bulkBusy || visibleInactiveIds.length === 0}
              className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-200 hover:bg-white/5 disabled:opacity-50"
              onClick={() => selectAllInactiveVisible()}
            >
              Selecionar inativas visíveis
            </button>
            <button
              type="button"
              disabled={bulkBusy || bulkSelectedIds.size === 0}
              className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-200 hover:bg-white/5 disabled:opacity-50"
              onClick={() => clearBulkSelection()}
            >
              Limpar seleção
            </button>
            <Button
              className="!min-h-0 !px-3 !py-1 !text-xs"
              variant="secondary"
              onClick={() => void batchActivateSelected()}
              disabled={bulkBusy}
            >
              {bulkBusyKind === "activate" ? "Ativando..." : "Aprovar selecionadas (ativar)"}
            </Button>
            <Button
              className="!min-h-0 !px-3 !py-1 !text-xs"
              variant="secondary"
              onClick={() => void batchRegenerateSelectedWithAI()}
              disabled={bulkBusy || generatorBusy}
            >
              {bulkBusyKind === "regen" ? "Regenerando..." : "Regenerar selecionadas com IA"}
            </Button>
            <Button
              className="!min-h-0 !px-3 !py-1 !text-xs"
              variant="secondary"
              onClick={() => void batchDeactivateSelected()}
              disabled={bulkBusy}
            >
              {bulkBusyKind === "deactivate" ? "Inativando..." : "Inativar selecionadas"}
            </Button>
            <Button
              className="!min-h-0 !px-3 !py-1 !text-xs"
              variant="danger"
              onClick={() => void batchDeleteSelected()}
              disabled={bulkBusy}
            >
              {bulkBusyKind === "delete" ? "Excluindo..." : "Excluir selecionadas"}
            </Button>
          </div>

          <div className="space-y-2">
            {rows.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma pergunta cadastrada ainda.</p>
            ) : null}
            {rows.length > 0 && filteredRows.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma pergunta com esses filtros.</p>
            ) : null}
            {filteredRows.map((row) => {
              const issues = detectQuizQuestionIssues(row);
              return (
                <div
                  key={row.id}
                  className={`flex w-full gap-2 rounded-lg border px-2 py-2 text-left transition ${
                    selectedId === row.id
                      ? "border-violet-400/40 bg-violet-500/10"
                      : "border-white/10 bg-black/20"
                  }`}
                >
                  <div className="flex shrink-0 items-start pt-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-white/20"
                      checked={bulkSelectedIds.has(row.id)}
                      onChange={() => toggleBulkId(row.id)}
                      aria-label={`Selecionar pergunta ${row.id}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className="min-w-0 flex-1 text-left hover:opacity-95"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="line-clamp-2 text-sm font-medium text-white">{row.question}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                          row.active ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-500/15 text-slate-300"
                        }`}
                      >
                        {row.active ? "Ativa" : "Inativa"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {row.category || "Sem categoria"} · {row.difficulty || "medio"} · peso {row.weight ?? 1}
                    </p>
                    {issues.length > 0 ? (
                      <p className="mt-1 text-xs text-amber-200/90">
                        Atenção: {issues.join(" · ")}
                      </p>
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-white/10 bg-slate-900/80 p-4">
          <h2 className="text-lg font-semibold text-white">
            {selectedId ? "Editar pergunta" : "Nova pergunta"}
          </h2>

          <Field
            label="Pergunta"
            value={form.question}
            onChange={(value) => setForm((current) => ({ ...current, question: value }))}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Opção A"
              value={form.optionA}
              onChange={(value) => setForm((current) => ({ ...current, optionA: value }))}
            />
            <Field
              label="Opção B"
              value={form.optionB}
              onChange={(value) => setForm((current) => ({ ...current, optionB: value }))}
            />
            <Field
              label="Opção C"
              value={form.optionC}
              onChange={(value) => setForm((current) => ({ ...current, optionC: value }))}
            />
            <Field
              label="Opção D"
              value={form.optionD}
              onChange={(value) => setForm((current) => ({ ...current, optionD: value }))}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Field
              label="Categoria"
              value={form.category}
              onChange={(value) => setForm((current) => ({ ...current, category: value }))}
            />
            <SelectField
              label="Dificuldade"
              value={form.difficulty}
              onChange={(value) =>
                setForm((current) => ({ ...current, difficulty: value as QuizQuestionDifficulty }))
              }
              options={[
                { value: "facil", label: "Fácil" },
                { value: "medio", label: "Médio" },
                { value: "dificil", label: "Difícil" },
              ]}
            />
            <SelectField
              label="Resposta correta"
              value={form.correctIndex}
              onChange={(value) => setForm((current) => ({ ...current, correctIndex: value }))}
              options={[
                { value: "0", label: "A" },
                { value: "1", label: "B" },
                { value: "2", label: "C" },
                { value: "3", label: "D" },
              ]}
            />
            <Field
              label="Peso no sorteio"
              value={form.weight}
              onChange={(value) => setForm((current) => ({ ...current, weight: value }))}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((current) => ({ ...current, active: e.target.checked }))}
            />
            Pergunta ativa no jogo
          </label>

          <div className="flex flex-wrap justify-end gap-2">
            {selectedId ? (
              <button
                type="button"
                onClick={() => void removeSelected()}
                disabled={busy}
                className="rounded-lg border border-red-400/20 px-4 py-2 text-sm text-red-200 hover:bg-red-500/10 disabled:opacity-60"
              >
                Excluir
              </button>
            ) : null}
            <Button onClick={() => void save()} disabled={busy}>
              {busy ? "Salvando..." : "Salvar pergunta"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function formatAiLogicUserPlainMessage(error: unknown, title: string): string {
  const text = error instanceof Error ? error.message : String(error);
  const apiNotEnabled =
    /api-not-enabled|firebasevertexai\.googleapis\.com|Firebase AI API requires/i.test(text);
  const pid = firebaseConfig.projectId?.trim();
  const aiLogicUrl = pid
    ? `https://console.firebase.google.com/project/${encodeURIComponent(pid)}/ailogic/`
    : "https://console.firebase.google.com/";
  if (apiNotEnabled) {
    return [
      title,
      "Ative o Firebase AI Logic no Console (Vertex AI Gemini ou Gemini Developer API).",
      "Ajuste NEXT_PUBLIC_FIREBASE_AI_BACKEND no .env.local e reinicie npm run dev.",
      `Abrir: ${aiLogicUrl}`,
    ].join(" ");
  }
  return `${title}: ${text}`;
}

function getQuizBaseModel() {
  const backend =
    getFirebaseAiBackend() === "vertex"
      ? new VertexAIBackend(firebaseVertexAiLocation)
      : new GoogleAIBackend();
  const ai = getAI(getFirebaseApp(), {
    backend,
    ...(firebaseAiAppCheckLimitedUseTokens ? { useLimitedUseAppCheckTokens: true } : {}),
  });
  return getGenerativeModel(ai, { model: "gemini-2.5-flash" });
}

/**
 * Envia responseMimeType + responseSchema no corpo da requisição.
 * Só na inicialização do modelo, algumas versões do SDK não repassam o MIME type e o backend retorna AI/unsupported.
 */
async function warmAppCheckTokenIfConfigured(): Promise<void> {
  if (typeof window === "undefined" || !appCheckSiteKey) return;
  const ac = initFirebaseAppCheck();
  if (!ac) return;
  try {
    await getToken(ac, false);
  } catch {
    /* localhost sem debug token / rede */
  }
}

async function generateQuizStructuredJson(
  prompt: string,
  responseSchema: typeof quizGenerationSchema | typeof quizSingleRegenSchema,
): Promise<string> {
  await warmAppCheckTokenIfConfigured();
  const model = getQuizBaseModel();
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
    },
  });
  return result.response.text();
}

function detectQuizQuestionIssues(row: QuizQuestionDoc): string[] {
  const issues: string[] = [];
  const q = row.question.trim();
  if (q.length < 8) issues.push("pergunta muito curta");
  const opts = row.options.map((o) => String(o).trim());
  if (opts.length !== 4) issues.push(`precisa de 4 opções (atual: ${opts.length})`);
  if (opts.some((o) => !o)) issues.push("opção vazia");
  const lower = opts.map((o) => o.toLowerCase());
  if (lower.length > 0 && new Set(lower).size !== lower.length) issues.push("opções duplicadas");
  const ci = row.correctIndex;
  if (!Number.isInteger(ci) || ci < 0 || ci >= opts.length) issues.push("índice da resposta correta inválido");
  return issues;
}

function normalizeGeneratedQuestion(
  item: GeneratedQuizPayload["questions"][number],
  fallbackCategory: string,
  fallbackDifficulty: QuizQuestionDifficulty,
) {
  const question = String(item.question ?? "").trim();
  const options = Array.isArray(item.options)
    ? item.options.map((option) => String(option).trim()).filter(Boolean)
    : [];
  const correctIndex = Number(item.correctIndex);
  if (!question || options.length !== 4 || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
    return null;
  }
  const difficulty =
    item.difficulty === "facil" || item.difficulty === "medio" || item.difficulty === "dificil"
      ? item.difficulty
      : fallbackDifficulty;
  return {
    question,
    options,
    correctIndex,
    category: String(item.category || fallbackCategory || "").trim() || null,
    difficulty,
    weight: Math.max(1, Math.floor(Number(item.weight) || 1)),
  };
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-slate-400">{label}</label>
      <input
        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-xs text-slate-400">{label}</label>
      <select
        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
