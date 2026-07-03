import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatKz, formatDate } from "@/lib/format";
import { PageHeader, PrimaryButton, GhostButton, Modal, Field, TextInput, SelectInput } from "@/components/ui-kit";
import { Plus, Trash2, Target, Star, TrendingUp, TrendingDown, History, Trophy } from "lucide-react";
import { toast } from "sonner";

const OBJ_URL = "https://azura0.lovable.app/app/objetivos";
const OBJ_TITLE = "Objetivos — Azura Capital";
const OBJ_DESC = "Defina metas financeiras, acompanhe a progressão e descubra quanto precisa de poupar por mês para as atingir a tempo.";

export const Route = createFileRoute("/_authenticated/app/objetivos")({
  head: () => ({
    meta: [
      { title: OBJ_TITLE },
      { name: "description", content: OBJ_DESC },
      { property: "og:title", content: OBJ_TITLE },
      { property: "og:description", content: OBJ_DESC },
      { property: "og:url", content: OBJ_URL },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [{ rel: "canonical", href: OBJ_URL }],
  }),
  component: Page,
});

const DEFAULT_CATS = ["Comprar casa", "Comprar carro", "Pagar dívida", "Reserva de emergência", "Viagem"];
const CATS_KEY = "azura_goal_categories";

const parseNum = (s: string) => {
  const n = Number(String(s ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function loadCats(): string[] {
  if (typeof window === "undefined") return DEFAULT_CATS;
  try {
    const raw = localStorage.getItem(CATS_KEY);
    if (!raw) return DEFAULT_CATS;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length ? arr : DEFAULT_CATS;
  } catch { return DEFAULT_CATS; }
}
function saveCats(list: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CATS_KEY, JSON.stringify(list));
}

// current_amount é mantido pelo trigger recalc_goal_current_amount() no Supabase,
// com base na soma de goal_transactions.amount. Aqui só derivamos os campos de apresentação.
function withDerivedFields(goal: any) {
  const current = Number(goal.current_amount ?? 0);
  const target = Number(goal.target_amount ?? 0);
  const remaining = Math.max(0, target - current);
  const progress = target > 0 ? Math.min((current / target) * 100, 100) : 0;

  let monthlyRequired = 0;
  let monthsRemaining = 0;

  if (goal.target_date) {
    const today = new Date();
    const targetDate = new Date(goal.target_date);
    monthsRemaining = Math.max(
      1,
      (targetDate.getFullYear() - today.getFullYear()) * 12 + (targetDate.getMonth() - today.getMonth())
    );
    monthlyRequired = remaining / monthsRemaining;
  }

  return {
    ...goal,
    current,
    target,
    remaining,
    progress,
    monthlyRequired,
    monthsRemaining,
    completed: Boolean(goal.is_completed) || (target > 0 && current >= target),
  };
}

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [txGoal, setTxGoal] = useState<any | null>(null);

  const { data: goals } = useQuery({
    queryKey: ["goals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .order("is_primary", { ascending: false });

      if (error) throw error;
      return (data ?? []).map(withDerivedFields);
    },
  });

  const del = async (id: string) => {
    await supabase.from("goals").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["goals"] });
  };

  const togglePrimary = async (id: string) => {
    await supabase.from("goals").update({ is_primary: false } as never).neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("goals").update({ is_primary: true } as never).eq("id", id);
    qc.invalidateQueries({ queryKey: ["goals"] });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader title="Objetivos" subtitle="Metas patrimoniais" action={<PrimaryButton onClick={() => setOpen(true)}><Plus className="h-4 w-4 inline mr-1" /> Novo Objetivo</PrimaryButton>} />

      <div className="grid gap-4 md:grid-cols-2">
        {(goals ?? []).length === 0 && <div className="glass rounded-3xl p-12 text-center text-sm text-muted-foreground md:col-span-2">Sem objetivos. Defina a sua primeira meta.</div>}
        {(goals ?? []).map((g: any) => (
          <div key={g.id} className={`glass rounded-3xl p-6 ${g.completed ? "ring-1 ring-primary/40" : ""}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <div className="rounded-full p-2 bg-primary/10 text-primary shrink-0">
                  {g.completed ? <Trophy className="h-4 w-4" /> : <Target className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold flex items-center gap-2 truncate">{g.name} {g.is_primary && <Star className="h-4 w-4 fill-primary text-primary shrink-0" />}</div>
                  {g.notes && <div className="text-sm text-muted-foreground truncate">{g.notes}</div>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => togglePrimary(g.id)} className="text-muted-foreground hover:text-primary p-1" title="Marcar como principal"><Star className="h-4 w-4" /></button>
                <button onClick={() => del(g.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">{formatKz(g.current)}</span>
                <span className="font-semibold">{formatKz(g.target)}</span>
              </div>
              <div className="h-3 rounded-full bg-secondary overflow-hidden">
                <div className={`h-full transition-all ${g.completed ? "bg-primary" : "gradient-primary"}`} style={{ width: `${g.progress}%` }} />
              </div>
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>{g.completed ? "🏆 Meta concluída" : `${g.progress.toFixed(0)}% concluído`}</span>
                {g.target_date && <span>até {formatDate(g.target_date)}</span>}
              </div>
            </div>

            {!g.completed && (
              <div className="mt-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Falta atingir</span>
                  <span className="font-semibold">{formatKz(g.remaining)}</span>
                </div>
                {g.target_date && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Necessário investir/mês</span>
                      <span className="font-semibold">{formatKz(g.monthlyRequired)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Prazo restante</span>
                      <span>{g.monthsRemaining} meses</span>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="mt-4">
              <GhostButton onClick={() => setTxGoal(g)} className="w-full justify-center">
                <TrendingUp className="h-4 w-4 inline mr-1" /> Atualizar progresso
              </GhostButton>
            </div>
          </div>
        ))}
      </div>

      <GoalModal open={open} onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["goals"] }); }} />
      <GoalTransactionModal goal={txGoal} open={!!txGoal} onClose={() => setTxGoal(null)} />
    </div>
  );
}

function GoalModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const now = new Date();
  const [cats, setCats] = useState<string[]>(loadCats());
  const [newCat, setNewCat] = useState("");
  const [form, setForm] = useState({
    name: "",
    notes: "",
    target_amount: "",
    target_month: String(now.getMonth() + 1),
    target_year: String(now.getFullYear() + 1),
  });
  const [loading, setLoading] = useState(false);

  const addCat = () => {
    const v = newCat.trim();
    if (!v) return;
    if (cats.includes(v)) { setForm(f => ({ ...f, name: v })); setNewCat(""); return; }
    const next = [...cats, v];
    setCats(next); saveCats(next);
    setForm(f => ({ ...f, name: v }));
    setNewCat("");
  };

  const save = async () => {
    if (!user || !form.name.trim() || !form.target_amount) { toast.error("Preencha os campos obrigatórios"); return; }
    setLoading(true);
    const y = Number(form.target_year);
    const m = Number(form.target_month);
    const target_date = `${y}-${String(m).padStart(2, "0")}-01`;
    // current_amount começa sempre em 0: valores já poupados devem ser
    // registados como o primeiro movimento em "Adicionar valor", para
    // manter o histórico completo desde o início.
    const { error } = await supabase.from("goals").insert({
      user_id: user.id,
      name: form.name.trim(),
      notes: form.notes || null,
      target_amount: parseNum(form.target_amount),
      current_amount: 0,
      is_completed: false,
      target_date,
    } as never);
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Objetivo criado"); onClose(); }
  };

  const years = Array.from({ length: 30 }, (_, i) => now.getFullYear() + i);

  return (
    <Modal open={open} onClose={onClose} title="Novo Objetivo">
      <div className="space-y-3">
        <Field label="Categoria">
          <SelectInput value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}>
            <option value="">Selecionar categoria...</option>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
          </SelectInput>
          <div className="flex gap-2 mt-2">
            <TextInput placeholder="+ Nova categoria" value={newCat} onChange={e => setNewCat(e.target.value)} />
            <GhostButton onClick={addCat} type="button">Criar</GhostButton>
          </div>
        </Field>
        <Field label="Meta (Kz)"><TextInput inputMode="decimal" value={form.target_amount} onChange={e => setForm({ ...form, target_amount: e.target.value })} /></Field>
        <p className="text-xs text-muted-foreground -mt-1">
          Se já tiver algum valor poupado para esta meta, adicione-o depois de criar, através de "Atualizar progresso".
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mês alvo"><SelectInput value={form.target_month} onChange={e => setForm({ ...form, target_month: e.target.value })}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </SelectInput></Field>
          <Field label="Ano alvo"><SelectInput value={form.target_year} onChange={e => setForm({ ...form, target_year: e.target.value })}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </SelectInput></Field>
        </div>
        <Field label="Notas (opcional)"><TextInput value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
        <div className="flex gap-2 justify-end pt-2">
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <PrimaryButton onClick={save} disabled={loading}>Guardar</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

function GoalTransactionModal({ goal, open, onClose }: { goal: any | null; open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: txs } = useQuery({
    queryKey: ["goal_transactions", goal?.id],
    enabled: !!goal?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goal_transactions")
        .select("*")
        .eq("goal_id", goal.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const reset = () => { setAmount(""); setNote(""); setMode("add"); };
  const close = () => { reset(); onClose(); };

  const save = async () => {
    if (!user || !goal) return;
    const value = parseNum(amount);
    if (!value || value <= 0) { toast.error("Indique um valor válido"); return; }
    if (mode === "remove" && value > Number(goal.current)) {
      toast.error("Não pode retirar mais do que o valor atual investido");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("goal_transactions").insert({
      goal_id: goal.id,
      user_id: user.id,
      amount: mode === "add" ? value : -value,
      note: note || null,
    } as never);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(mode === "add" ? "Valor adicionado" : "Valor retirado");
    reset();
    qc.invalidateQueries({ queryKey: ["goals"] });
    qc.invalidateQueries({ queryKey: ["goal_transactions", goal.id] });
  };

  if (!goal) return null;

  return (
    <Modal open={open} onClose={close} title={`Atualizar progresso — ${goal.name}`}>
      <div className="space-y-4">
        <div className="flex justify-between text-sm bg-secondary/50 rounded-2xl p-3">
          <span className="text-muted-foreground">Valor atual</span>
          <span className="font-semibold">{formatKz(goal.current)}</span>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("add")}
            className={`flex-1 rounded-xl py-2 text-sm font-medium flex items-center justify-center gap-1 border transition ${mode === "add" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
          >
            <TrendingUp className="h-4 w-4" /> Adicionar valor
          </button>
          <button
            type="button"
            onClick={() => setMode("remove")}
            className={`flex-1 rounded-xl py-2 text-sm font-medium flex items-center justify-center gap-1 border transition ${mode === "remove" ? "bg-destructive text-destructive-foreground border-destructive" : "border-border text-muted-foreground"}`}
          >
            <TrendingDown className="h-4 w-4" /> Retirar valor
          </button>
        </div>

        <Field label="Valor (Kz)">
          <TextInput inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Nota (opcional)">
          <TextInput value={note} onChange={e => setNote(e.target.value)} placeholder="Ex: Depósito mensal, venda parcial..." />
        </Field>

        <div className="flex gap-2 justify-end">
          <GhostButton onClick={close}>Cancelar</GhostButton>
          <PrimaryButton onClick={save} disabled={loading}>
            {mode === "add" ? "Adicionar" : "Retirar"}
          </PrimaryButton>
        </div>

        {(txs ?? []).length > 0 && (
          <div className="pt-3 border-t border-border">
            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-2">
              <History className="h-3.5 w-3.5" /> Histórico de movimentos
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {(txs ?? []).map((t: any) => (
                <div key={t.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg hover:bg-secondary/50">
                  <div className="min-w-0">
                    <div className={`font-medium ${Number(t.amount) >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {Number(t.amount) >= 0 ? "+" : ""}{formatKz(t.amount)}
                    </div>
                    {t.note && <div className="text-xs text-muted-foreground truncate">{t.note}</div>}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{formatDate(t.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
