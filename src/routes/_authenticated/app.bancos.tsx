import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, PrimaryButton, GhostButton, Modal, Field, SelectInput, SelectWithCustom } from "@/components/ui-kit";
import { Plus, Trash2, Landmark, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/bancos")({
  head: () => ({ meta: [{ title: "Bancos — Azura Capital" }] }),
  component: Page,
});

const BANCOS_ANGOLA = ["BAI", "BFA", "BIC", "BPC", "BCI", "BCGA", "Atlântico", "Standard Bank", "Millennium Atlântico", "Sol", "Keve", "Yetu"];

const ACCOUNT_TYPES = [
  { value: "corrente", label: "Corrente" },
  { value: "poupanca", label: "Poupança" },
  { value: "prazo", label: "A Prazo" },
  { value: "salario", label: "Salário" },
  { value: "negocio", label: "Negócio" },
];

const fmtMoney = (v: number, currency = "AOA") => {
  try { return new Intl.NumberFormat("pt-PT", { style: "currency", currency, maximumFractionDigits: 2 }).format(v); }
  catch { return `${v.toLocaleString("pt-PT", { maximumFractionDigits: 2 })} ${currency}`; }
};

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("todos");

  const { data: accounts } = useQuery({
    queryKey: ["bank_accounts", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("bank_accounts").select("*").order("bank_name")).data ?? [],
  });

  const filtered = useMemo(() => (accounts ?? []).filter((a: any) => filter === "todos" || a.id === filter), [accounts, filter]);
  const totalKz = (accounts ?? []).filter((a: any) => a.currency === "AOA").reduce((s, a: any) => s + Number(a.current_balance), 0);
  const anyNegative = (accounts ?? []).some((a: any) => Number(a.current_balance) < 0);

  const del = async (id: string) => {
    await supabase.from("bank_accounts").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["bank_accounts"] });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader title="Bancos" subtitle="Saldos atualizados automaticamente pelas suas operações" action={<PrimaryButton onClick={() => setOpen(true)}><Plus className="h-4 w-4 inline mr-1" /> Nova Conta</PrimaryButton>} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass rounded-3xl p-6 flex items-center gap-4">
          <div className="rounded-full p-3 bg-primary/10 text-primary shrink-0"><Landmark className="h-6 w-6" /></div>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Saldo Total (AOA)</div>
            <div className={`text-2xl sm:text-3xl font-bold truncate ${totalKz < 0 ? "text-destructive" : ""}`}>{fmtMoney(totalKz, "AOA")}</div>
          </div>
        </div>
        {anyNegative && (
          <div className="glass rounded-3xl p-6 flex items-center gap-4 border border-destructive/40">
            <div className="rounded-full p-3 bg-destructive/10 text-destructive shrink-0"><AlertTriangle className="h-6 w-6" /></div>
            <div className="min-w-0">
              <div className="text-xs text-destructive font-semibold">Atenção</div>
              <div className="text-sm">Há contas com saldo negativo.</div>
            </div>
          </div>
        )}
      </div>

      {(accounts ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilter("todos")} className={`rounded-full px-4 py-1.5 text-sm font-medium ${filter === "todos" ? "gradient-primary text-white" : "bg-secondary hover:bg-secondary/70"}`}>Todos</button>
          {(accounts ?? []).map((a: any) => (
            <button key={a.id} onClick={() => setFilter(a.id)} className={`rounded-full px-4 py-1.5 text-sm font-medium ${filter === a.id ? "gradient-primary text-white" : "bg-secondary hover:bg-secondary/70"}`}>{a.bank_name}</button>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 && <div className="glass rounded-3xl p-12 text-center text-sm text-muted-foreground md:col-span-2 lg:col-span-3">Sem contas. Adicione a sua primeira conta bancária.</div>}
        {filtered.map((a: any) => {
          const neg = Number(a.current_balance) < 0;
          return (
            <div key={a.id} className={`glass rounded-3xl p-5 hover:scale-[1.01] transition ${neg ? "border border-destructive/40" : ""}`}>
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wide text-primary font-medium truncate">{a.bank_name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{ACCOUNT_TYPES.find(t => t.value === a.account_type)?.label ?? a.account_type}</div>
                </div>
                <button onClick={() => del(a.id)} aria-label="Eliminar conta" className="text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Saldo Disponível</div>
              <div className={`mt-1 text-2xl font-bold ${neg ? "text-destructive" : ""}`}>{fmtMoney(Number(a.current_balance), a.currency)}</div>
              {neg && <div className="mt-2 text-xs text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Saldo negativo</div>}
            </div>
          );
        })}
      </div>

      <AccountModal open={open} onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["bank_accounts"] }); }} />
    </div>
  );
}

function AccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ bank_name: "", account_type: "corrente", currency: "AOA" });
  const [loading, setLoading] = useState(false);

  const save = async () => {
    const bankName = form.bank_name.trim();
    if (!user || !bankName) { toast.error("Selecione o banco"); return; }
    setLoading(true);
    const { error } = await supabase.from("bank_accounts").insert({
      user_id: user.id,
      bank_name: bankName,
      account_type: form.account_type,
      currency: form.currency,
      current_balance: 0,
    } as never);
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Conta adicionada"); setForm({ bank_name: "", account_type: "corrente", currency: "AOA" }); onClose(); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nova Conta">
      <div className="space-y-3">
        <SelectWithCustom
          label="Banco"
          value={form.bank_name}
          onChange={v => setForm({ ...form, bank_name: v })}
          options={BANCOS_ANGOLA.map(b => ({ value: b, label: b }))}
          customLabel="Outro banco..."
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo"><SelectInput value={form.account_type} onChange={e => setForm({ ...form, account_type: e.target.value })}>
            {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </SelectInput></Field>
          <Field label="Moeda"><SelectInput value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
            <option>AOA</option><option>USD</option><option>EUR</option>
          </SelectInput></Field>
        </div>
        <p className="text-xs text-muted-foreground">O saldo começa em zero e é atualizado automaticamente pelas receitas, despesas e operações de investimento.</p>
        <div className="flex gap-2 justify-end pt-2">
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <PrimaryButton onClick={save} disabled={loading}>Guardar</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
