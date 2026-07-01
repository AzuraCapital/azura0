import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { PageHeader, PrimaryButton, GhostButton, Modal, Field, TextInput, SelectInput, TextArea } from "@/components/ui-kit";
import { Plus, Trash2, TrendingUp, ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/investimentos")({
  head: () => ({ meta: [{ title: "Investimentos — Azura Capital" }] }),
  component: Page,
});

// Aceita "1500,50" e "1500.50"
const parseNum = (s: string) => {
  const n = Number(String(s ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const fmtMoney = (v: number, currency = "AOA") => {
  try {
    return new Intl.NumberFormat("pt-PT", { style: "currency", currency, maximumFractionDigits: 2 }).format(v);
  } catch {
    return `${v.toLocaleString("pt-PT", { maximumFractionDigits: 2 })} ${currency}`;
  }
};
const fmtQty = (v: number) => v.toLocaleString("pt-PT", { maximumFractionDigits: 6 });

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [opAssetId, setOpAssetId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: assets } = useQuery({
    queryKey: ["assets", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("assets").select("*, asset_categories(name), custody_accounts(name)").order("created_at", { ascending: false })).data ?? [],
  });

  const del = async (id: string) => {
    await supabase.from("asset_transactions").delete().eq("asset_id", id);
    await supabase.from("assets").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["assets"] });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader title="Investimentos" subtitle="A sua carteira" action={<PrimaryButton onClick={() => setOpen(true)}><Plus className="h-4 w-4 inline mr-1" /> Novo Ativo</PrimaryButton>} />

      <div className="glass rounded-3xl p-6 flex items-center gap-4">
        <div className="rounded-full p-3 bg-primary/10 text-primary shrink-0"><TrendingUp className="h-6 w-6" /></div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Ativos</div>
          <div className="text-2xl sm:text-3xl font-bold truncate">{(assets ?? []).length}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(assets ?? []).length === 0 && <div className="glass rounded-3xl p-12 text-center text-sm text-muted-foreground md:col-span-2 lg:col-span-3">Sem ativos. Adicione o seu primeiro investimento.</div>}
        {(assets ?? []).map((a: any) => {
          const isOpen = expanded === a.id;
          return (
            <div key={a.id} className="glass rounded-3xl p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-primary font-medium uppercase tracking-wide truncate">{a.asset_categories?.name}</div>
                  <div className="font-semibold mt-1 truncate">{a.name}</div>
                </div>
                <button onClick={() => del(a.id)} className="text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-4 pt-4 border-t border-border/50 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Quantidade</span><span className="font-medium">{fmtQty(Number(a.quantity ?? 0))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Valor investido</span><span className="font-bold text-primary">{fmtMoney(Number(a.invested_amount ?? 0), a.currency)}</span></div>
                {a.acquisition_date && <div className="flex justify-between"><span className="text-muted-foreground">Aquisição</span><span>{formatDate(a.acquisition_date)}</span></div>}
                {a.custody_accounts && <div className="flex justify-between"><span className="text-muted-foreground">Custódia</span><span>{a.custody_accounts.name}</span></div>}
              </div>
              <div className="mt-4 flex gap-2">
                <GhostButton className="flex-1" onClick={() => setOpAssetId(a.id)}>Nova operação</GhostButton>
                <GhostButton onClick={() => setExpanded(isOpen ? null : a.id)}>{isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</GhostButton>
              </div>
              {isOpen && <History assetId={a.id} currency={a.currency} />}
            </div>
          );
        })}
      </div>

      <AssetModal open={open} onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["assets"] }); }} />
      <OperationModal
        assetId={opAssetId}
        asset={(assets ?? []).find((a: any) => a.id === opAssetId)}
        onClose={() => { setOpAssetId(null); qc.invalidateQueries({ queryKey: ["assets"] }); }}
      />
    </div>
  );
}

function History({ assetId, currency }: { assetId: string; currency: string }) {
  const { data: txs } = useQuery({
    queryKey: ["asset_tx", assetId],
    queryFn: async () => (await supabase.from("asset_transactions").select("*").eq("asset_id", assetId).order("transaction_date", { ascending: true }).order("created_at", { ascending: true })).data ?? [],
  });
  let running = 0;
  const rows = (txs ?? []).map((t: any) => {
    const q = Number(t.quantity ?? 0);
    running += t.type === "compra" ? q : -q;
    return { ...t, remaining: running };
  }).reverse();
  return (
    <div className="mt-4 pt-4 border-t border-border/50">
      <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Histórico</div>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">Sem operações.</div>
      ) : (
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {rows.map((t: any) => (
            <div key={t.id} className="flex items-center gap-2 text-xs">
              <div className={`rounded-full p-1 ${t.type === "compra" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                {t.type === "compra" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{t.type === "compra" ? "Compra" : "Venda"} · {fmtQty(Number(t.quantity ?? 0))}</div>
                <div className="text-muted-foreground">{formatDate(t.transaction_date)} · restante {fmtQty(t.remaining)}</div>
              </div>
              <div className={`font-semibold shrink-0 ${t.type === "compra" ? "text-success" : "text-destructive"}`}>{fmtMoney(Number(t.amount ?? 0), currency)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AssetModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", asset_category_id: "", custody_account_id: "", quantity: "", amount: "", currency: "AOA", acquisition_date: "", notes: "" });
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
  };
  const addCust = async () => {
    if (!user || !newCust.trim()) return;
    const { data, error } = await supabase.from("custody_accounts").insert({ user_id: user.id, name: newCust.trim() } as never).select().single();
    if (error) return toast.error(error.message);
    setNewCust("");
    await qc.invalidateQueries({ queryKey: ["custody_accounts"] });
    if (data) setForm(f => ({ ...f, custody_account_id: (data as any).id }));
  };

  const save = async () => {
    const qty = parseNum(form.quantity);
    const amt = parseNum(form.amount);
    if (!user || !form.name || !form.asset_category_id || qty <= 0 || amt <= 0) { toast.error("Preencha os campos obrigatórios"); return; }
    setLoading(true);
    const { data: created, error } = await supabase.from("assets").insert({
      user_id: user.id,
      asset_category_id: form.asset_category_id,
      custody_account_id: form.custody_account_id || null,
      name: form.name,
      quantity: qty,
      invested_amount: amt,
      currency: form.currency,
      acquisition_date: form.acquisition_date || null,
      notes: form.notes || null,
    } as never).select().single();
    if (!error && created) {
      await supabase.from("asset_transactions").insert({
        user_id: user.id,
        asset_id: (created as any).id,
        type: "compra",
        quantity: qty,
        amount: amt,
        transaction_date: form.acquisition_date || new Date().toISOString().slice(0, 10),
      } as never);
    }
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantidade"><TextInput inputMode="decimal" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} placeholder="ex.: 1,25" /></Field>
          <Field label="Moeda"><SelectInput value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
            <option>AOA</option><option>USD</option><option>EUR</option>
          </SelectInput></Field>
        </div>
        <Field label="Valor"><TextInput inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="ex.: 1500,50" /></Field>
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

function OperationModal({ assetId, asset, onClose }: { assetId: string | null; asset: any; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ type: "compra" as "compra" | "venda", quantity: "", amount: "", transaction_date: new Date().toISOString().slice(0, 10) });
  const [loading, setLoading] = useState(false);
  const currency = asset?.currency ?? "AOA";
  const currentQty = Number(asset?.quantity ?? 0);
  const currentInvested = Number(asset?.invested_amount ?? 0);

  const save = async () => {
    if (!user || !assetId) return;
    const qty = parseNum(form.quantity);
    const amt = parseNum(form.amount);
    if (qty <= 0 || amt <= 0) { toast.error("Quantidade e valor obrigatórios"); return; }
    if (form.type === "venda" && qty > currentQty) { toast.error(`Só pode vender até ${fmtQty(currentQty)}`); return; }
    setLoading(true);
    const newQty = form.type === "compra" ? currentQty + qty : currentQty - qty;
    const newInvested = form.type === "compra"
      ? currentInvested + amt
      : Math.max(0, currentInvested - (currentQty > 0 ? (currentInvested * qty) / currentQty : 0));
    const { error: e1 } = await supabase.from("asset_transactions").insert({
      user_id: user.id, asset_id: assetId, type: form.type, quantity: qty, amount: amt, transaction_date: form.transaction_date,
    } as never);
    const { error: e2 } = await supabase.from("assets").update({ quantity: newQty, invested_amount: newInvested } as never).eq("id", assetId);
    setLoading(false);
    const err = e1 || e2;
    if (err) toast.error(err.message);
    else {
      toast.success("Operação registada");
      qc.invalidateQueries({ queryKey: ["asset_tx", assetId] });
      qc.invalidateQueries({ queryKey: ["assets"] });
      setForm({ type: "compra", quantity: "", amount: "", transaction_date: new Date().toISOString().slice(0, 10) });
      onClose();
    }
  };

  return (
    <Modal open={!!assetId} onClose={onClose} title={`Operação — ${asset?.name ?? ""}`}>
      <div className="space-y-3">
        <div className="text-xs text-muted-foreground">Posição atual: <b>{fmtQty(currentQty)}</b> · {fmtMoney(currentInvested, currency)}</div>
        <div className="flex gap-2">
          {(["compra", "venda"] as const).map(t => (
            <button key={t} onClick={() => setForm({ ...form, type: t })} className={`flex-1 rounded-full px-4 py-2 text-sm font-medium ${form.type === t ? (t === "compra" ? "bg-success text-white" : "bg-destructive text-white") : "bg-secondary"}`}>
              {t === "compra" ? "Compra" : "Venda"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantidade"><TextInput inputMode="decimal" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} placeholder="ex.: 0,5" /></Field>
          <Field label={`Valor (${currency})`}><TextInput inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="ex.: 1500,50" /></Field>
        </div>
        <Field label="Data"><TextInput type="date" value={form.transaction_date} onChange={e => setForm({ ...form, transaction_date: e.target.value })} /></Field>
        <div className="flex gap-2 justify-end pt-2">
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <PrimaryButton onClick={save} disabled={loading}>Registar</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
