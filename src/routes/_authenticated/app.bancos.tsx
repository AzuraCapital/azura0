import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, PrimaryButton, GhostButton, Modal, Field, TextInput, SelectInput, SelectWithCustom } from "@/components/ui-kit";
import { Plus, Trash2, Landmark } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/bancos")({
  head: () => ({ meta: [{ title: "Bancos — Azura Capital" }] }),
  component: Page,
});

const BANCOS_ANGOLA = ["BAI", "BFA", "BIC", "BPC", "BCI", "BCGA", "Atlântico", "Standard Bank", "Millennium Atlântico", "Sol", "Keve", "Yetu"];

const parseNum = (s: string) => {
  const n = Number(String(s ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const fmtMoney = (v: number, currency = "AOA") => {
  try { return new Intl.NumberFormat("pt-PT", { style: "currency", currency, maximumFractionDigits: 2 }).format(v); }
  catch { return `${v.toLocaleString("pt-PT", { maximumFractionDigits: 2 })} ${currency}`; }
};

const ACCOUNT_TYPES = [
  { value: "corrente", label: "Corrente" },
  { value: "poupanca", label: "Poupança" },
  { value: "prazo", label: "A Prazo" },
  { value: "salario", label: "Salário" },
  { value: "negocio", label: "Negócio" },
];

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: accounts } = useQuery({
    queryKey: ["bank_accounts", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("bank_accounts").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const totalKz = (accounts ?? []).filter((a: any) => a.currency === "AOA").reduce((s, a: any) => s + Number(a.current_balance), 0);

  const del = async (id: string) => {
    await supabase.from("bank_accounts").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["bank_accounts"] });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader title="Contas Bancárias" subtitle="Saldos e movimentos" action={<PrimaryButton onClick={() => setOpen(true)}><Plus className="h-4 w-4 inline mr-1" /> Nova Conta</PrimaryButton>} />

      <div className="glass rounded-3xl p-6 flex items-center gap-4">
        <div className="rounded-full p-3 bg-primary/10 text-primary shrink-0"><Landmark className="h-6 w-6" /></div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Saldo total (AOA)</div>
          <div className="text-2xl sm:text-3xl font-bold truncate">{fmtMoney(totalKz, "AOA")}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(accounts ?? []).length === 0 && <div className="glass rounded-3xl p-12 text-center text-sm text-muted-foreground md:col-span-2 lg:col-span-3">Sem contas. Adicione a sua primeira conta bancária.</div>}
        {(accounts ?? []).map((a: any) => (
          <div key={a.id} className="glass rounded-3xl p-5 hover:scale-[1.01] transition">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-primary font-medium truncate">{a.bank_name}</div>
                <div className="text-xs text-muted-foreground capitalize mt-1">{ACCOUNT_TYPES.find(t => t.value === a.account_type)?.label ?? a.account_type}</div>
              </div>
              <button onClick={() => del(a.id)} className="text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 text-2xl font-bold">{fmtMoney(Number(a.current_balance), a.currency)}</div>
          </div>
        ))}
      </div>

      <AccountModal open={open} onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["bank_accounts"] }); }} />
    </div>
  );
}

function AccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ bank_name: "", account_type: "corrente", currency: "AOA", current_balance: "" });
  const [loading, setLoading] = useState(false);

  const save = async () => {
    const bankName = form.bank_name.trim();
    const bal = parseNum(form.current_balance);
    if (!user || !bankName) { toast.error("Selecione o banco"); return; }
    setLoading(true);
    const { error } = await supabase.from("bank_accounts").insert({
      user_id: user.id,
      bank_name: bankName,
      account_type: form.account_type,
      currency: form.currency,
      current_balance: bal,
    } as never);
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Conta adicionada"); setForm({ bank_name: "", account_type: "corrente", currency: "AOA", current_balance: "" }); onClose(); }
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
        <Field label={`Valor (${form.currency})`}><TextInput inputMode="decimal" value={form.current_balance} onChange={e => setForm({ ...form, current_balance: e.target.value })} placeholder="ex.: 1500,50" /></Field>
        <div className="flex gap-2 justify-end pt-2">
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <PrimaryButton onClick={save} disabled={loading}>Guardar</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
