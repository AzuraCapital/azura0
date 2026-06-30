import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatKz, formatDate } from "@/lib/format";
import { PageHeader, PrimaryButton, GhostButton, Modal, Field, TextInput, SelectInput, TextArea } from "@/components/ui-kit";
import { Plus, Trash2, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";

export const Route = createFileRoute("/_authenticated/app/financas")({
  head: () => ({ meta: [{ title: "Finanças — Azura Capital" }] }),
  component: Page,
});

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"todos" | "receita" | "despesa">("todos");

  const { data: txns } = useQuery({
    queryKey: ["transactions", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("transactions").select("*, income_categories(name, color), expense_categories(name, color), bank_accounts(account_name)").order("transaction_date", { ascending: false }).limit(100)).data ?? [],
  });

  const filtered = (txns ?? []).filter((t: any) => tab === "todos" || t.type === tab);

  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");
  const monthTx = (txns ?? []).filter((t: any) => t.transaction_date >= monthStart && t.transaction_date <= monthEnd);
  const rec = monthTx.filter((t: any) => t.type === "receita").reduce((s, t: any) => s + Number(t.amount), 0);
  const desp = monthTx.filter((t: any) => t.type === "despesa").reduce((s, t: any) => s + Number(t.amount), 0);

  const del = async (id: string) => {
    await supabase.from("transactions").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader title="Finanças Pessoais" subtitle="Receitas e despesas" action={<PrimaryButton onClick={() => setOpen(true)}><Plus className="h-4 w-4 inline mr-1" /> Nova Transação</PrimaryButton>} />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Receitas (mês)" value={formatKz(rec)} icon={ArrowUpCircle} color="success" />
        <StatCard label="Despesas (mês)" value={formatKz(desp)} icon={ArrowDownCircle} color="destructive" />
        <StatCard label="Saldo (mês)" value={formatKz(rec - desp)} icon={ArrowUpCircle} color={rec - desp >= 0 ? "success" : "destructive"} />
      </div>

      <div className="flex gap-2">
        {(["todos", "receita", "despesa"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${tab === t ? "gradient-primary text-white" : "bg-secondary hover:bg-secondary/70"}`}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      <div className="glass rounded-3xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Sem transações.</div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map((t: any) => {
              const cat = t.type === "receita" ? t.income_categories : t.expense_categories;
              return (
                <div key={t.id} className="flex items-center gap-4 p-4 hover:bg-secondary/40 transition">
                  <div className={`rounded-full p-2.5 ${t.type === "receita" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                    {t.type === "receita" ? <ArrowUpCircle className="h-5 w-5" /> : <ArrowDownCircle className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{t.description || cat?.name || "Sem descrição"}</div>
                    <div className="text-xs text-muted-foreground">{cat?.name} · {formatDate(t.transaction_date)} {t.bank_accounts && `· ${t.bank_accounts.account_name}`}</div>
                  </div>
                  <div className={`font-semibold ${t.type === "receita" ? "text-success" : "text-destructive"}`}>
                    {t.type === "receita" ? "+" : "-"}{formatKz(t.amount)}
                  </div>
                  <button onClick={() => del(t.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="h-4 w-4" /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TxModal open={open} onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["transactions"] }); }} />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className={`rounded-full p-2 bg-${color}/10 text-${color}`}><Icon className="h-4 w-4" /></div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function TxModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ type: "despesa" as "despesa" | "receita", amount: "", description: "", transaction_date: format(new Date(), "yyyy-MM-dd"), category_id: "", bank_account_id: "" });
  const [loading, setLoading] = useState(false);

  const { data: cats } = useQuery({
    queryKey: ["cats", form.type, user?.id],
    enabled: !!user && open,
    queryFn: async () => (await supabase.from(form.type === "receita" ? "income_categories" : "expense_categories").select("*").order("name")).data ?? [],
  });
  const { data: accounts } = useQuery({
    queryKey: ["accs", user?.id],
    enabled: !!user && open,
    queryFn: async () => (await supabase.from("bank_accounts").select("id, account_name, bank_name").order("account_name")).data ?? [],
  });

  const save = async () => {
    if (!user || !form.amount || !form.category_id) { toast.error("Preencha os campos obrigatórios"); return; }
    setLoading(true);
    const payload: any = {
      user_id: user.id,
      type: form.type,
      amount: Number(form.amount),
      description: form.description || null,
      transaction_date: form.transaction_date,
      bank_account_id: form.bank_account_id || null,
    };
    if (form.type === "receita") payload.income_category_id = form.category_id;
    else payload.expense_category_id = form.category_id;
    const { error } = await supabase.from("transactions").insert(payload as never);
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Transação registada"); onClose(); }
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
        <Field label="Valor (Kz)"><TextInput type="number" step="any" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></Field>
        <Field label="Categoria"><SelectInput value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
          <option value="">Selecionar...</option>
          {(cats ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectInput></Field>
        <Field label="Conta (opcional)"><SelectInput value={form.bank_account_id} onChange={e => setForm({ ...form, bank_account_id: e.target.value })}>
          <option value="">—</option>
          {(accounts ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.bank_name} — {a.account_name}</option>)}
        </SelectInput></Field>
        <Field label="Data"><TextInput type="date" value={form.transaction_date} onChange={e => setForm({ ...form, transaction_date: e.target.value })} /></Field>
        <Field label="Descrição"><TextArea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
        <div className="flex gap-2 justify-end pt-2">
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <PrimaryButton onClick={save} disabled={loading}>Guardar</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
