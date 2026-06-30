import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatKz, formatDate } from "@/lib/format";
import { PageHeader, PrimaryButton, GhostButton, Modal, Field, TextInput, SelectInput, TextArea } from "@/components/ui-kit";
import { Plus, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/investimentos")({
  head: () => ({ meta: [{ title: "Investimentos — Azura Capital" }] }),
  component: Page,
});

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: assets } = useQuery({
    queryKey: ["assets", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("assets").select("*, asset_categories(name), custody_accounts(name)").order("created_at", { ascending: false })).data ?? [],
  });

  const total = (assets ?? []).reduce((s, a: any) => s + Number(a.invested_amount), 0);

  const del = async (id: string) => {
    await supabase.from("assets").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["assets"] });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader title="Investimentos" subtitle="A sua carteira" action={<PrimaryButton onClick={() => setOpen(true)}><Plus className="h-4 w-4 inline mr-1" /> Novo Ativo</PrimaryButton>} />

      <div className="glass rounded-3xl p-6 flex items-center gap-4">
        <div className="rounded-full p-3 bg-primary/10 text-primary shrink-0"><TrendingUp className="h-6 w-6" /></div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Total Investido</div>
          <div className="text-2xl sm:text-3xl font-bold truncate">{formatKz(total)}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(assets ?? []).length === 0 && <div className="glass rounded-3xl p-12 text-center text-sm text-muted-foreground md:col-span-2 lg:col-span-3">Sem ativos. Adicione o seu primeiro investimento.</div>}
        {(assets ?? []).map((a: any) => (
          <div key={a.id} className="glass rounded-3xl p-5">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="text-xs text-primary font-medium uppercase tracking-wide truncate">{a.asset_categories?.name}</div>
                <div className="font-semibold mt-1 truncate">{a.name}</div>
                {a.ticker && <div className="text-xs text-muted-foreground">{a.ticker}</div>}
              </div>
              <button onClick={() => del(a.id)} className="text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 pt-4 border-t border-border/50 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Quantidade</span><span className="font-medium">{a.quantity}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">PM</span><span className="font-medium">{formatKz(a.avg_price)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Investido</span><span className="font-bold text-primary">{formatKz(a.invested_amount)}</span></div>
              {a.acquisition_date && <div className="flex justify-between"><span className="text-muted-foreground">Aquisição</span><span>{formatDate(a.acquisition_date)}</span></div>}
              {a.custody_accounts && <div className="flex justify-between"><span className="text-muted-foreground">Custódia</span><span>{a.custody_accounts.name}</span></div>}
            </div>
          </div>
        ))}
      </div>

      <AssetModal open={open} onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["assets"] }); }} />
    </div>
  );
}

function AssetModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", ticker: "", asset_category_id: "", custody_account_id: "", quantity: "", avg_price: "", acquisition_date: "", notes: "" });
  const [newCat, setNewCat] = useState("");
  const [newCust, setNewCust] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: cats } = useQuery({
    queryKey: ["asset_categories", user?.id],
    enabled: !!user && open,
    queryFn: async () => (await supabase.from("asset_categories").select("*").order("name")).data ?? [],
  });
  const { data: custodies } = useQuery({
    queryKey: ["custody_accounts", user?.id],
    enabled: !!user && open,
    queryFn: async () => (await supabase.from("custody_accounts").select("*").order("name")).data ?? [],
  });

  const addCat = async () => {
    if (!user || !newCat.trim()) return;
    const { data, error } = await supabase.from("asset_categories").insert({ user_id: user.id, name: newCat.trim() } as never).select().single();
    if (error) return toast.error(error.message);
    setNewCat("");
    await qc.invalidateQueries({ queryKey: ["asset_categories"] });
    if (data) setForm(f => ({ ...f, asset_category_id: (data as any).id }));
    toast.success("Categoria criada");
  };
  const addCust = async () => {
    if (!user || !newCust.trim()) return;
    const { data, error } = await supabase.from("custody_accounts").insert({ user_id: user.id, name: newCust.trim() } as never).select().single();
    if (error) return toast.error(error.message);
    setNewCust("");
    await qc.invalidateQueries({ queryKey: ["custody_accounts"] });
    if (data) setForm(f => ({ ...f, custody_account_id: (data as any).id }));
    toast.success("Custódia criada");
  };

  const save = async () => {
    if (!user || !form.name || !form.asset_category_id || !form.quantity || !form.avg_price) { toast.error("Preencha os campos obrigatórios"); return; }
    setLoading(true);
    const qty = Number(form.quantity); const px = Number(form.avg_price);
    const { error } = await supabase.from("assets").insert({
      user_id: user.id,
      asset_category_id: form.asset_category_id,
      custody_account_id: form.custody_account_id || null,
      name: form.name,
      ticker: form.ticker || null,
      quantity: qty,
      avg_price: px,
      invested_amount: qty * px,
      acquisition_date: form.acquisition_date || null,
      notes: form.notes || null,
    } as never);
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Ativo adicionado"); onClose(); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Novo Ativo">
      <div className="space-y-3">
        <Field label="Categoria">
          <SelectInput value={form.asset_category_id} onChange={e => setForm({ ...form, asset_category_id: e.target.value })}>
            <option value="">Selecionar...</option>
            {(cats ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectInput>
          <div className="flex gap-2 mt-2">
            <TextInput placeholder="+ Nova categoria" value={newCat} onChange={e => setNewCat(e.target.value)} />
            <GhostButton onClick={addCat} type="button">Criar</GhostButton>
          </div>
        </Field>
        <Field label="Custódia (opcional)">
          <SelectInput value={form.custody_account_id} onChange={e => setForm({ ...form, custody_account_id: e.target.value })}>
            <option value="">—</option>
            {(custodies ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectInput>
          <div className="flex gap-2 mt-2">
            <TextInput placeholder="+ Nova custódia" value={newCust} onChange={e => setNewCust(e.target.value)} />
            <GhostButton onClick={addCust} type="button">Criar</GhostButton>
          </div>
        </Field>
        <Field label="Nome"><TextInput value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Ticker (opcional)"><TextInput value={form.ticker} onChange={e => setForm({ ...form, ticker: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantidade"><TextInput type="number" step="any" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></Field>
          <Field label="Preço médio"><TextInput type="number" step="any" value={form.avg_price} onChange={e => setForm({ ...form, avg_price: e.target.value })} /></Field>
        </div>
        <Field label="Data de aquisição"><TextInput type="date" value={form.acquisition_date} onChange={e => setForm({ ...form, acquisition_date: e.target.value })} /></Field>
        <Field label="Notas"><TextArea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
        <div className="flex gap-2 justify-end pt-2">
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <PrimaryButton onClick={save} disabled={loading}>Guardar</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
