import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { PageHeader, PrimaryButton, GhostButton, Modal, Field, TextInput, SelectInput, SelectWithCustom } from "@/components/ui-kit";
import { ExportButton } from "@/components/ExportButton";
import { exportToExcel, exportToPdf } from "@/lib/export";
import { Plus, Trash2, Landmark, AlertTriangle, SlidersHorizontal, X as XIcon, Receipt, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

const BANK_URL = "https://azura0.lovable.app/app/bancos";
const BANK_TITLE = "Bancos — Azura Capital";
const BANK_DESC = "Consolide as suas contas bancárias e acompanhe saldos atualizados automaticamente por receitas, despesas e operações de investimento.";

export const Route = createFileRoute("/_authenticated/app/bancos")({
  head: () => ({
    meta: [
      { title: BANK_TITLE },
      { name: "description", content: BANK_DESC },
      { property: "og:title", content: BANK_TITLE },
      { property: "og:description", content: BANK_DESC },
      { property: "og:url", content: BANK_URL },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [{ rel: "canonical", href: BANK_URL }],
  }),
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

const parseNum = (s: string) => {
  const n = Number(String(s ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("todos");
  const [adjustBank, setAdjustBank] = useState<any | null>(null);
  const [statementBank, setStatementBank] = useState<any | null>(null);

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
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setStatementBank(a)} aria-label="Ver extrato" title="Ver extrato" className="text-muted-foreground hover:text-primary"><Receipt className="h-4 w-4" /></button>
                  <button onClick={() => setAdjustBank(a)} aria-label="Ajustar saldo" title="Ajustar saldo" className="text-muted-foreground hover:text-primary"><SlidersHorizontal className="h-4 w-4" /></button>
                  <button onClick={() => del(a.id)} aria-label="Eliminar conta" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Saldo Disponível</div>
              <div className={`mt-1 text-2xl font-bold ${neg ? "text-destructive" : ""}`}>{fmtMoney(Number(a.current_balance), a.currency)}</div>
              {neg && <div className="mt-2 text-xs text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Saldo negativo</div>}
              <button onClick={() => setStatementBank(a)} className="mt-3 w-full rounded-full px-3 py-1.5 text-xs font-medium bg-secondary hover:bg-secondary/70 inline-flex items-center justify-center gap-1.5"><Receipt className="h-3.5 w-3.5" /> Ver Extrato</button>
            </div>
          );
        })}
      </div>

      <AccountModal open={open} onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["bank_accounts"] }); }} />
      <BalanceAdjustmentModal bank={adjustBank} onClose={() => { setAdjustBank(null); qc.invalidateQueries({ queryKey: ["bank_accounts"] }); }} />
      <BankStatementModal bank={statementBank} onClose={() => setStatementBank(null)} />
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

function BalanceAdjustmentModal({ bank, onClose }: { bank: any | null; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [direction, setDirection] = useState<"credito" | "debito">("credito");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: adjustments } = useQuery({
    queryKey: ["bank_balance_adjustments", bank?.id],
    enabled: !!bank,
    queryFn: async () =>
      (await supabase
        .from("bank_balance_adjustments")
        .select("*")
        .eq("bank_account_id", bank.id)
        .order("created_at", { ascending: false })
      ).data ?? [],
  });

  if (!bank) return null;

  const submit = async () => {
    const amt = parseNum(amount);
    if (amt <= 0) { toast.error("Valor obrigatório"); return; }
    if (!reason.trim()) { toast.error("Indique o motivo do ajuste"); return; }

    setLoading(true);
    const { error } = await supabase.from("bank_balance_adjustments").insert({
      user_id: user!.id,
      bank_account_id: bank.id,
      amount: direction === "credito" ? amt : -amt,
      reason: reason.trim(),
    } as never);
    setLoading(false);

    if (error) toast.error(error.message);
    else {
      toast.success("Saldo ajustado");
      setAmount("");
      setReason("");
      qc.invalidateQueries({ queryKey: ["bank_accounts"] });
      qc.invalidateQueries({ queryKey: ["bank_balance_adjustments", bank.id] });
    }
  };

  const undo = async (id: string) => {
    const { error } = await supabase.from("bank_balance_adjustments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Ajuste revertido");
    qc.invalidateQueries({ queryKey: ["bank_accounts"] });
    qc.invalidateQueries({ queryKey: ["bank_balance_adjustments", bank.id] });
  };

  return (
    <Modal open={!!bank} onClose={onClose} title={`Ajustar Saldo — ${bank.bank_name}`}>
      <div className="space-y-4">
        <div className="glass rounded-xl p-3 text-sm flex justify-between">
          <span className="text-muted-foreground">Saldo atual</span>
          <span className="font-semibold">{fmtMoney(Number(bank.current_balance ?? 0), bank.currency)}</span>
        </div>

        <p className="text-xs text-muted-foreground">
          Use isto apenas para corrigir divergências (ex.: erro de digitação, saldo inicial mal definido, dados de teste). O ajuste fica registado no histórico com o motivo indicado.
        </p>

        <div className="space-y-3">
          <Field label="Tipo de ajuste">
            <SelectInput value={direction} onChange={e => setDirection(e.target.value as any)}>
              <option value="credito">Aumentar saldo (crédito)</option>
              <option value="debito">Reduzir saldo (débito)</option>
            </SelectInput>
          </Field>
          <Field label={`Valor (${bank.currency})`}>
            <TextInput inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="ex.: 5000" />
          </Field>
          <Field label="Motivo (obrigatório)">
            <TextInput value={reason} onChange={e => setReason(e.target.value)} placeholder="ex.: Correção de teste de dívida" />
          </Field>
          <div className="flex justify-end">
            <PrimaryButton onClick={submit} disabled={loading}>Registar Ajuste</PrimaryButton>
          </div>
        </div>

        {(adjustments ?? []).length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Histórico de Ajustes</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {(adjustments ?? []).map((a: any) => (
                <div key={a.id} className="flex items-center gap-2 text-sm py-1.5 border-b border-border/50 last:border-0">
                  <span className={a.amount > 0 ? "text-success" : "text-destructive"}>
                    {a.amount > 0 ? "+" : ""}{fmtMoney(Number(a.amount), bank.currency)}
                  </span>
                  <span className="text-xs text-muted-foreground flex-1 truncate">{a.reason} · {formatDate(a.created_at)}</span>
                  <button onClick={() => undo(a.id)} className="text-muted-foreground hover:text-destructive shrink-0" title="Reverter">
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
