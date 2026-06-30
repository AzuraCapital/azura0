import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatKz, formatDate } from "@/lib/format";
import { PageHeader, PrimaryButton, GhostButton, Modal, Field, TextInput, SelectInput, TextArea } from "@/components/ui-kit";
import { Plus, Trash2, TrendingDown, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/patrimonio")({
  head: () => ({ meta: [{ title: "Património — Azura Capital" }] }),
  component: Page,
});

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: liab } = useQuery({
    queryKey: ["liab", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("liabilities").select("*").order("due_date")).data ?? [],
  });
  const { data: stats } = useQuery({
    queryKey: ["patrimonio-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [a, b] = await Promise.all([
        supabase.from("assets").select("invested_amount"),
        supabase.from("bank_accounts").select("current_balance"),
      ]);
      const inv = (a.data ?? []).reduce((s, x) => s + Number(x.invested_amount), 0);
      const bnk = (b.data ?? []).reduce((s, x) => s + Number(x.current_balance), 0);
      return { inv, bnk };
    },
  });

  const totalLiab = (liab ?? []).filter(l => l.type !== "divida_a_receber").reduce((s, l) => s + Number(l.amount), 0);
  const receivable = (liab ?? []).filter(l => l.type === "divida_a_receber").reduce((s, l) => s + Number(l.amount), 0);
  const net = (stats?.inv ?? 0) + (stats?.bnk ?? 0) + receivable - totalLiab;

  const del = async (id: string) => {
    await supabase.from("liabilities").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["liab"] });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader title="Património" subtitle="Ativos, passivos e dívidas" action={<PrimaryButton onClick={() => setOpen(true)}><Plus className="h-4 w-4 inline mr-1" /> Novo Passivo</PrimaryButton>} />

      <div className="glass rounded-3xl p-8 text-center">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Património Líquido</div>
        <div className="text-5xl font-bold text-gradient-primary">{formatKz(net)}</div>
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div><div className="text-muted-foreground">Investido</div><div className="font-semibold">{formatKz(stats?.inv ?? 0)}</div></div>
          <div><div className="text-muted-foreground">Bancos</div><div className="font-semibold">{formatKz(stats?.bnk ?? 0)}</div></div>
          <div><div className="text-muted-foreground">Passivos</div><div className="font-semibold text-destructive">{formatKz(totalLiab)}</div></div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {(liab ?? []).length === 0 && <div className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground lg:col-span-3">Sem passivos. Adicione dívidas a pagar/receber ou empréstimos.</div>}
        {(liab ?? []).map(l => (
          <div key={l.id} className="glass rounded-3xl p-5 hover:scale-[1.01] transition">
            <div className="flex items-start justify-between mb-3">
              <div className={`rounded-full p-2 ${l.type === "divida_a_receber" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                {l.type === "divida_a_receber" ? <TrendingUp className="h-4 w-4" /> : l.type === "emprestimo" ? <Users className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              </div>
              <button onClick={() => del(l.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{labelFor(l.type)}</div>
            <div className="font-semibold mt-1">{l.counterparty}</div>
            <div className="text-2xl font-bold mt-2">{formatKz(l.amount)}</div>
            {l.due_date && <div className="text-xs text-muted-foreground mt-1">Vence: {formatDate(l.due_date)}</div>}
            {l.description && <div className="text-sm text-muted-foreground mt-2">{l.description}</div>}
          </div>
        ))}
      </div>

      <LiabilityModal open={open} onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["liab"] }); }} />
    </div>
  );
}

function labelFor(t: string) { return t === "divida_a_receber" ? "A Receber" : t === "emprestimo" ? "Empréstimo" : "A Pagar"; }

function LiabilityModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ type: "divida_a_pagar", counterparty: "", amount: "", due_date: "", description: "" });
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!user || !form.counterparty || !form.amount) { toast.error("Preencha os campos obrigatórios"); return; }
    setLoading(true);
    const { error } = await supabase.from("liabilities").insert({
      user_id: user.id,
      type: form.type,
      counterparty: form.counterparty,
      amount: Number(form.amount),
      due_date: form.due_date || null,
      description: form.description || null,
    } as never);
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Adicionado"); setForm({ type: "divida_a_pagar", counterparty: "", amount: "", due_date: "", description: "" }); onClose(); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Novo Passivo">
      <div className="space-y-3">
        <Field label="Tipo"><SelectInput value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
          <option value="divida_a_pagar">Dívida a Pagar</option>
          <option value="divida_a_receber">Dívida a Receber</option>
          <option value="emprestimo">Empréstimo</option>
        </SelectInput></Field>
        <Field label="Contraparte (pessoa/entidade)"><TextInput value={form.counterparty} onChange={e => setForm({ ...form, counterparty: e.target.value })} /></Field>
        <Field label="Valor (Kz)"><TextInput type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></Field>
        <Field label="Data de vencimento"><TextInput type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></Field>
        <Field label="Descrição"><TextArea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
        <div className="flex gap-2 justify-end pt-2">
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <PrimaryButton onClick={save} disabled={loading}>Guardar</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
