import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, PrimaryButton, GhostButton, Modal, Field, TextInput, SelectInput } from "@/components/ui-kit";
import { Plus, Trash2, Vault } from "lucide-react";
import { toast } from "sonner";

const CUS_URL = "https://azura0.lovable.app/app/custodia";
const CUS_TITLE = "Conta Custódia — Azura Capital";
const CUS_DESC = "Gestão de contas custódia associadas a bancos, usadas para movimentar automaticamente saldos em compras e vendas de investimentos.";

export const Route = createFileRoute("/_authenticated/app/custodia")({
  head: () => ({
    meta: [
      { title: CUS_TITLE },
      { name: "description", content: CUS_DESC },
      { property: "og:title", content: CUS_TITLE },
      { property: "og:description", content: CUS_DESC },
      { property: "og:url", content: CUS_URL },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [{ rel: "canonical", href: CUS_URL }],
  }),
  component: Page,
});

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: custodies } = useQuery({
    queryKey: ["custody_accounts", user?.id],
    enabled: !!user,
    queryFn: async () => {

    const { data: custodies } = await supabase
        .from("custody_accounts")
        .select(`
            *,
            bank_accounts(bank_name,currency),
            assets(invested_amount)
        `)
        .order("name");

    return custodies ?? [];

},
  });

  const del = async (id: string) => {
    const { error } = await supabase.from("custody_accounts").delete().eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["custody_accounts"] });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Conta Custódia"
        subtitle="Contas de intermediação associadas ao seu banco. Compras e vendas atualizam o saldo do banco associado."
        action={<PrimaryButton onClick={() => setOpen(true)}><Plus className="h-4 w-4 inline mr-1" /> Nova Custódia</PrimaryButton>}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(custodies ?? []).length === 0 && (
          <div className="glass rounded-3xl p-12 text-center text-sm text-muted-foreground md:col-span-2 lg:col-span-3">Sem contas custódia. Crie uma para associar aos seus investimentos.</div>
        )}
        {(custodies ?? []).map((c: any) => (
          <div key={c.id} className="glass rounded-3xl p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="rounded-full p-2 bg-primary/10 text-primary shrink-0"><Vault className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                 <div className="space-y-1 mt-1">

    <div className="text-xs text-muted-foreground">

        {c.bank_accounts
            ? `Banco: ${c.bank_accounts.bank_name}`
            : "Sem banco associado"}

    </div>

    <div className="text-xs text-muted-foreground">
        Valor sob gestão
    </div>

    <div className="font-semibold text-primary">

        {new Intl.NumberFormat("pt-PT", {
            style: "currency",
            currency: "AOA"
        }).format(

            (c.assets ?? []).reduce(

                (total: number, asset: any) =>
                    total + Number(asset.invested_amount ?? 0),

                0

            )

        )}

    </div>

</div>
                </div>
              </div>
              <button onClick={() => del(c.id)} className="text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>

      <CustodyModal open={open} onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["custody_accounts"] }); }} />
    </div>
  );
}

function CustodyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: "", bank_account_id: "" });
  const [loading, setLoading] = useState(false);

  const { data: banks } = useQuery({
    queryKey: ["bank_accounts", user?.id],
    enabled: !!user && open,
    queryFn: async () => (await supabase.from("bank_accounts").select("id, bank_name").order("bank_name")).data ?? [],
  });

  const save = async () => {
    if (!user || !form.name.trim()) { toast.error("Indique o nome"); return; }
    setLoading(true);
    const { error } = await supabase.from("custody_accounts").insert({
      user_id: user.id,
      name: form.name.trim(),
      bank_account_id: form.bank_account_id || null,
    } as never);
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Custódia adicionada"); setForm({ name: "", bank_account_id: "" }); onClose(); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nova Conta Custódia">
      <div className="space-y-3">
        <Field label="Nome"><TextInput value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="ex.: BFA CM" /></Field>
        <Field label="Banco associado">
          <SelectInput value={form.bank_account_id} onChange={e => setForm({ ...form, bank_account_id: e.target.value })}>
            <option value="">— Sem banco —</option>
            {(banks ?? []).map((b: any) => <option key={b.id} value={b.id}>{b.bank_name}</option>)}
          </SelectInput>
        </Field>
        <p className="text-xs text-muted-foreground">Quando comprar/vender um ativo usando esta custódia, o saldo do banco associado é debitado/creditado automaticamente.</p>
        <div className="flex gap-2 justify-end pt-2">
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <PrimaryButton onClick={save} disabled={loading}>Guardar</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
