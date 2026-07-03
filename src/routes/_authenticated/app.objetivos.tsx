import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatKz, formatDate } from "@/lib/format";
import { PageHeader, PrimaryButton, GhostButton, Modal, Field, TextInput, SelectInput } from "@/components/ui-kit";
import { Plus, Trash2, Target, Star } from "lucide-react";
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

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: goals } = useQuery({
  queryKey: ["goals", user?.id],
  enabled: !!user,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .order("is_primary", { ascending: false });

    if (error) throw error;

    return (data ?? []).map(goal => {

      const current = Number(goal.current_amount ?? 0);
      const target = Number(goal.target_amount ?? 0);

      const remaining = Math.max(0, target - current);

      const progress =
        target > 0
          ? Math.min((current / target) * 100, 100)
          : 0;

      let monthlyRequired = 0;
      let monthsRemaining = 0;

      if (goal.target_date) {

        const today = new Date();

        const targetDate = new Date(goal.target_date);

        monthsRemaining =
          Math.max(
            1,
            (targetDate.getFullYear() - today.getFullYear()) * 12 +
            targetDate.getMonth() -
            today.getMonth()
          );

        monthlyRequired =
          remaining / monthsRemaining;
      }

      return {

        ...goal,

        current,

        target,

        remaining,

        progress,

        monthlyRequired,

        monthsRemaining,

        completed: current >= target

      };

    });

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
        {(goals ?? []).map((g: any) => {
          const pct = Math.min(100, (Number(g.current_amount) / Number(g.target_amount)) * 100);
          return (
            <div key={g.id} className="glass rounded-3xl p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="rounded-full p-2 bg-primary/10 text-primary shrink-0"><Target className="h-4 w-4" /></div>
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
                  <span className="text-muted-foreground">{formatKz(g.current_amount)}</span>
                  <span className="font-semibold">{formatKz(g.target_amount)}</span>
                </div>
                <div className="h-3 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full gradient-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>{pct.toFixed(0)}% concluído</span>
                  {g.target_date && <span>até {formatDate(g.target_date)}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <GoalModal open={open} onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["goals"] }); }} />
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
    current_amount: "",
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
    const { error } = await supabase.from("goals").insert({
      user_id: user.id,
      name: form.name.trim(),
      notes: form.notes || null,
      target_amount: parseNum(form.target_amount),
      current_amount: parseNum(form.current_amount),
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Meta (Kz)"><TextInput inputMode="decimal" value={form.target_amount} onChange={e => setForm({ ...form, target_amount: e.target.value })} /></Field>
          <Field label="Atual (Kz)"><TextInput inputMode="decimal" value={form.current_amount} onChange={e => setForm({ ...form, current_amount: e.target.value })} /></Field>
        </div>
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
