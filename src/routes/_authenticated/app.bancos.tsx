import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatKz } from "@/lib/format";
import { PageHeader, PrimaryButton, GhostButton, Modal, Field, TextInput, SelectInput } from "@/components/ui-kit";
import { Plus, Trash2, Landmark } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/bancos")({
  head: () => ({ meta: [{ title: "Bancos — Azura Capital" }] }),
  component: Page,
});

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: accounts } = useQuery({
    queryKey: ["bank_accounts", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("bank_accounts").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const total = (accounts ?? []).reduce((s, a: any) => s + Number(a.current_balance), 0);

  const del = async (id: string) => {
    await supabase.from("bank_accounts").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["bank_accounts"] });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader title="Contas Bancárias" subtitle="Saldos e movimentos" action={<PrimaryButton onClick={() => setOpen(true)}><Plus className="h-4 w-4 inline mr-1" /> Nova Conta</PrimaryButton>} />

      <div className="glass rounded-3xl p-6 flex items-center gap-4">
        <div className="rounded-full p-3 bg-primary/10 text-primary"><Landmark className="h-6 w-6" /></div>
        <div>
          <div className="text-xs text-muted-foreground">Saldo total</div>
          <div className="text-3xl font-bold">{formatKz(total)}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(accounts ?? []).length === 0 && <div className="glass rounded-3xl p-12 text-center text-sm text-muted-foreground md:col-span-2 lg:col-span-3">Sem contas. Adicione a sua primeira conta bancária.</div>}
        {(accounts ?? []).map((a: any) => (
          <div key={a.id} className="glass rounded-3xl p-5 hover:scale-[1.01] transition">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-primary font-medium">{a.bank_name}</div>
                <div className="font-semibold mt-1">{a.account_name}</div>
                <div className="text-xs text-muted-foreground capitalize">{a.account_type}</div>
              </div>
              <button onClick={() => del(a.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 text-2xl font-bold">{formatKz(a.current_balance)}</div>
            <div className="text-xs text-muted-foreground">{a.currency}</div>
          </div>
        ))}
      </div>

      <AccountModal open={open} onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["bank_accounts"] }); }} />
    </div>
  );
}

function AccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ bank_name: "", account_name: "", account_type: "corrente", currency: "AOA", current_balance: "" });
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!user || !form.bank_name || !form.account_name) { toast.error("Preencha os campos obrigatórios"); return; }
    setLoading(true);
    const { error } = await supabase.from("bank_accounts").insert({
      user_id: user.id,
      bank_name: form.bank_name,
      account_name: form.account_name,
      account_type: form.account_type,
      currency: form.currency,
      current_balance: Number(form.current_balance) || 0,
    } as never);
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Conta adicionada"); onClose(); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nova Conta">
      <div className="space-y-3">
        <Field label="Banco"><TextInput value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} placeholder="BAI, BFA, BIC..." /></Field>
        <Field label="Nome da conta"><TextInput value={form.account_name} onChange={e => setForm({ ...form, account_name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo"><SelectInput value={form.account_type} onChange={e => setForm({ ...form, account_type: e.target.value })}>
            <option value="corrente">Corrente</option>
            <option value="poupanca">Poupança</option>
            <option value="prazo">A Prazo</option>
          </SelectInput></Field>
          <Field label="Moeda"><SelectInput value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
            <option>AOA</option><option>USD</option><option>EUR</option>
          </SelectInput></Field>
        </div>
        <Field label="Saldo atual"><TextInput type="number" step="any" value={form.current_balance} onChange={e => setForm({ ...form, current_balance: e.target.value })} /></Field>
        <div className="flex gap-2 justify-end pt-2">
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <PrimaryButton onClick={save} disabled={loading}>Guardar</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
