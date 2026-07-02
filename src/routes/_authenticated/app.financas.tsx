import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatKz, formatDate } from "@/lib/format";
import { PageHeader, PrimaryButton, GhostButton, Modal, Field, TextInput, SelectInput, TextArea } from "@/components/ui-kit";
import { Plus, Trash2, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

export const Route = createFileRoute("/_authenticated/app/financas")({
  head: () => ({ meta: [{ title: "Finanças — Azura Capital" }] }),
  component: Page,
});

const parseNum = (s: string) => {
  const n = Number(String(s ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"todos" | "receita" | "despesa">("todos");
  const [period, setPeriod] = useState<"mensal" | "anual">("mensal");

  const { data: txns } = useQuery({
    queryKey: ["transactions", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("transactions").select("*, income_categories(name), expense_categories(name), bank_accounts(bank_name)").order("transaction_date", { ascending: false }).limit(500)).data ?? [],
  });

  const range = useMemo(() => {
    const now = new Date();
    if (period === "mensal") return { s: format(startOfMonth(now), "yyyy-MM-dd"), e: format(endOfMonth(now), "yyyy-MM-dd") };
    return { s: format(startOfYear(now), "yyyy-MM-dd"), e: format(endOfYear(now), "yyyy-MM-dd") };
  }, [period]);

  const periodTx = (txns ?? []).filter((t: any) => t.transaction_date >= range.s && t.transaction_date <= range.e);
  const filtered = periodTx.filter((t: any) => tab === "todos" || t.type === tab);
  const rec = periodTx.filter((t: any) => t.type === "receita").reduce((s, t: any) => s + Number(t.amount), 0);
  const desp = periodTx.filter((t: any) => t.type === "despesa").reduce((s, t: any) => s + Number(t.amount), 0);

  const del = async (id: string) => {
    await supabase.from("transactions").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["bank_accounts"] });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader title="Finanças Pessoais" subtitle="Receitas e despesas" action={<PrimaryButton onClick={() => setOpen(true)}><Plus className="h-4 w-4 inline mr-1" /> Nova Transação</PrimaryButton>} />

      <div className="flex gap-2">
        {(["mensal", "anual"] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)} className={`rounded-full px-4 py-1.5 text-sm font-medium ${period === p ? "gradient-primary text-white" : "bg-secondary hover:bg-secondary/70"}`}>{p === "mensal" ? "Mensal" : "Anual"}</button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
  <StatCard
    label={`Receitas (${period})`}
    value={formatKz(rec)}
    icon={ArrowUpCircle}
    color="success"
  />

  <StatCard
    label={`Despesas (${period})`}
    value={formatKz(desp)}
    icon={ArrowDownCircle}
    color="destructive"
  />
</div>

      <div className="flex gap-2 flex-wrap">
        {(["todos", "receita", "despesa"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === t ? "gradient-primary text-white" : "bg-secondary hover:bg-secondary/70"}`}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      <div className="glass rounded-3xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Sem transações no período.</div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map((t: any) => {
              const cat = t.type === "receita" ? t.income_categories : t.expense_categories;
              return (
                <div key={t.id} className="flex items-center gap-3 p-4 hover:bg-secondary/40 transition">
                  <div className={`rounded-full p-2.5 shrink-0 ${t.type === "receita" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                    {t.type === "receita" ? <ArrowUpCircle className="h-5 w-5" /> : <ArrowDownCircle className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{t.description || cat?.name || "Sem descrição"}</div>
                    <div className="text-xs text-muted-foreground truncate">{cat?.name} · {formatDate(t.transaction_date)}{t.bank_accounts && ` · ${t.bank_accounts.bank_name}`}</div>
                  </div>
                  <div className={`font-semibold text-right shrink-0 ${t.type === "receita" ? "text-success" : "text-destructive"}`}>
                    {t.type === "receita" ? "+" : "-"}{formatKz(t.amount)}
                  </div>
                  <button onClick={() => del(t.id)} className="text-muted-foreground hover:text-destructive p-1 shrink-0"><Trash2 className="h-4 w-4" /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TxModal open={open} onClose={() => setOpen(false)} onSaved={() => {
        qc.invalidateQueries({ queryKey: ["transactions"] });
        qc.invalidateQueries({ queryKey: ["bank_accounts"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
      }} />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  const colorClass = color === "success" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive";
  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-xs text-muted-foreground truncate">{label}</span>
        <div className={`rounded-full p-2 shrink-0 ${colorClass}`}><Icon className="h-4 w-4" /></div>
      </div>
      <div className="text-xl sm:text-2xl font-bold truncate">{value}</div>
    </div>
  );
}

function TxModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ type: "despesa" as "despesa" | "receita", amount: "", description: "", transaction_date: format(new Date(), "yyyy-MM-dd"), category_id: "", bank_account_id: "" });
  const [newCat, setNewCat] = useState("");
  const [loading, setLoading] = useState(false);

  const table = form.type === "receita" ? "income_categories" : "expense_categories";
  const { data: cats } = useQuery({
    queryKey: ["cats", form.type, user?.id],
    enabled: !!user && open,
    queryFn: async () => (await supabase.from(table).select("id, name").order("name")).data ?? [],
  });
  const { data: accounts } = useQuery({
    queryKey: ["accs", user?.id],
    enabled: !!user && open,
    queryFn: async () => (await supabase.from("bank_accounts").select("id, bank_name").order("bank_name")).data ?? [],
  });

  const addCat = async () => {
    if (!user || !newCat.trim()) return;
    const { data, error } = await supabase.from(table).insert({ user_id: user.id, name: newCat.trim() } as never).select().single();
    if (error) return toast.error(error.message);
    setNewCat("");
    await qc.invalidateQueries({ queryKey: ["cats", form.type] });
    if (data) setForm(f => ({ ...f, category_id: (data as any).id }));
  };

  const save = async () => {
    const amt = parseNum(form.amount);
    if (!user || amt <= 0 || !form.category_id || !form.bank_account_id) { toast.error("Preencha valor, categoria e banco"); return; }
    setLoading(true);
    const payload: any = {
      user_id: user.id,
      type: form.type,
      amount: amt,
      description: form.description || null,
      transaction_date: form.transaction_date,
      bank_account_id: form.bank_account_id,
      income_category_id: form.type === "receita" ? form.category_id : null,
      expense_category_id: form.type === "despesa" ? form.category_id : null,
    };
    const { error } = await supabase.from("transactions").insert(payload as never);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Transação registada");
    setForm({ type: form.type, amount: "", description: "", transaction_date: format(new Date(), "yyyy-MM-dd"), category_id: "", bank_account_id: "" });
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Nova Transação">
      <div className="space-y-3">
        <div className="flex gap-2">
          {(["despesa", "receita"] as const).map(t => (
            <button key={t} onClick={() => setForm({ ...form, type: t, category_id: "" })} className={`flex-1 rounded-full px-4 py-2 text-sm font-medium ${form.type === t ? (t === "receita" ? "bg-success text-white" : "bg-destructive text-white") : "bg-secondary"}`}>
              {t === "receita" ? "Receita" : "Despesa"}
            </button>
          ))}
        </div>
        <Field label="Valor (Kz)"><TextInput inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="ex.: 1500,50" /></Field>
        <Field label="Categoria">
          <SelectInput value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
            <option value="">Selecionar...</option>
            {(cats ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectInput>
          <div className="flex gap-2 mt-2">
            <TextInput placeholder="+ Nova categoria" value={newCat} onChange={e => setNewCat(e.target.value)} />
            <GhostButton onClick={addCat} type="button">Criar</GhostButton>
          </div>
        </Field>
        <Field label="Banco"><SelectInput value={form.bank_account_id} onChange={e => setForm({ ...form, bank_account_id: e.target.value })}>
          <option value="">Selecionar...</option>
          {(accounts ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.bank_name}</option>)}
        </SelectInput></Field>
        <Field label="Data"><TextInput type="date" value={form.transaction_date} onChange={e => setForm({ ...form, transaction_date: e.target.value })} /></Field>
        <Field label="Descrição"><TextArea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
        <p className="text-xs text-muted-foreground">{form.type === "receita" ? "Vai creditar" : "Vai debitar"} o saldo do banco selecionado automaticamente.</p>
        <div className="flex gap-2 justify-end pt-2">
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <PrimaryButton onClick={save} disabled={loading}>Guardar</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
