import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatKz, formatDate } from "@/lib/format";
import { PageHeader, GhostButton, PrimaryButton, Modal, Field, TextInput, SelectInput } from "@/components/ui-kit";
import { CheckCircle2, Circle, ArrowUpCircle, ArrowDownCircle, ChevronLeft, History, X as XIcon } from "lucide-react";
import { toast } from "sonner";

const DIV_URL = "https://azura0.lovable.app/app/dividas";
const DIV_TITLE = "Gestão de Dívida — Azura Capital";
const DIV_DESC = "Acompanhe os seus créditos e dívidas, prazos, juros e amortizações num painel dedicado e sincronizado com as contas bancárias.";

export const Route = createFileRoute("/_authenticated/app/dividas")({
  head: () => ({
    meta: [
      { title: DIV_TITLE },
      { name: "description", content: DIV_DESC },
      { property: "og:title", content: DIV_TITLE },
      { property: "og:description", content: DIV_DESC },
      { property: "og:url", content: DIV_URL },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [{ rel: "canonical", href: DIV_URL }],
  }),
  component: Page,
});

const parseNum = (s: string) => {
  const n = Number(String(s ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const isOpen = (status: string) => status !== "efetuado" && status !== "quitada";

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"receber" | "pagar">("pagar");
  const [paymentEvent, setPaymentEvent] = useState<any | null>(null);

  const { data: dividas } = useQuery({
    queryKey: ["dividas", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase
        .from("calendar_events")
        .select("*, bank_accounts(bank_name)")
        .in("category", ["divida_a_pagar", "divida_a_receber"])
        .order("event_date", { ascending: true })
      ).data ?? [],
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["dividas"] });
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["bank_accounts"] });
    qc.invalidateQueries({ queryKey: ["calendar_event_payments"] });
  };

  // Fallback: permite marcar diretamente como "efetuado" só quando ainda não há
  // nenhum movimento registado (ou seja, é equivalente a pagar tudo de uma vez
  // sem passar pelo ledger). Preferimos sempre empurrar para o modal de movimentos.
  const toggleStatus = async (e: any) => {
    if (!user) return;
    const next = e.status === "efetuado" ? "pendente" : "efetuado";
    const { error } = await supabase
      .from("calendar_events")
      .update({ status: next } as never)
      .eq("id", e.id);
    if (error) toast.error(error.message);
    else toast.success(next === "efetuado" ? "Marcada como paga" : "Marcada como não paga");
    invalidate();
  };

  const filtered = (dividas ?? []).filter((e: any) =>
    tab === "pagar" ? e.category === "divida_a_pagar" : e.category === "divida_a_receber"
  );

  const remainingOf = (e: any) => e.remaining_amount ?? e.amount ?? 0;

  const pendentes = filtered.filter((e: any) => isOpen(e.status));
  const liquidadas = filtered.filter((e: any) => !isOpen(e.status));

  const totalPendente = pendentes.reduce((s: number, e: any) => s + Number(remainingOf(e)), 0);
  const totalPago = filtered.reduce((s: number, e: any) => {
    const total = Number(e.amount ?? 0);
    const rem = Number(remainingOf(e));
    return s + Math.max(0, total - rem);
  }, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Gestão de Dívida"
        subtitle="Dívidas a pagar e a receber"
        action={
          <GhostButton onClick={() => navigate({ to: "/app/calendario" })}>
            <ChevronLeft className="h-4 w-4 inline mr-1" /> Calendário
          </GhostButton>
        }
      />

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("pagar")}
          className={`rounded-full px-5 py-2 text-sm font-medium transition ${
            tab === "pagar" ? "bg-destructive text-white" : "bg-secondary hover:bg-secondary/70"
          }`}
        >
          A Pagar
        </button>
        <button
          onClick={() => setTab("receber")}
          className={`rounded-full px-5 py-2 text-sm font-medium transition ${
            tab === "receber" ? "gradient-primary text-white" : "bg-secondary hover:bg-secondary/70"
          }`}
        >
          A Receber
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass rounded-3xl p-5">
          <div className="text-xs text-muted-foreground mb-1">
            {tab === "pagar" ? "Total em dívida" : "Total a receber"}
          </div>
          <div className={`text-2xl font-bold ${tab === "pagar" ? "text-destructive" : "text-success"}`}>
            {formatKz(totalPendente)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {pendentes.length} pendente{pendentes.length !== 1 ? "s" : ""}
          </div>
        </div>
        <div className="glass rounded-3xl p-5">
          <div className="text-xs text-muted-foreground mb-1">
            {tab === "pagar" ? "Total já pago" : "Total já recebido"}
          </div>
          <div className="text-2xl font-bold text-muted-foreground">{formatKz(totalPago)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {liquidadas.length} liquidada{liquidadas.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Pendentes */}
      {pendentes.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Pendentes
          </h2>
          <div className="space-y-2">
            {pendentes.map((e: any) => (
              <DebtRow key={e.id} event={e} onToggle={toggleStatus} onPayments={setPaymentEvent} tab={tab} />
            ))}
          </div>
        </div>
      )}

      {/* Liquidadas */}
      {liquidadas.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Liquidadas
          </h2>
          <div className="space-y-2 opacity-60">
            {liquidadas.map((e: any) => (
              <DebtRow key={e.id} event={e} onToggle={toggleStatus} onPayments={setPaymentEvent} tab={tab} done />
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="glass rounded-3xl p-12 text-center text-sm text-muted-foreground">
          Sem dívidas {tab === "pagar" ? "a pagar" : "a receber"}. Crie um evento do tipo correspondente no Calendário.
        </div>
      )}

      <PaymentModal event={paymentEvent} onClose={() => { setPaymentEvent(null); invalidate(); }} />
    </div>
  );
}

function DebtRow({ event: e, onToggle, onPayments, tab, done }: {
  event: any;
  onToggle: (e: any) => void;
  onPayments: (e: any) => void;
  tab: "pagar" | "receber";
  done?: boolean;
}) {
  const total = Number(e.amount ?? 0);
  const remaining = Number(e.remaining_amount ?? e.amount ?? 0);
  const paid = Math.max(0, total - remaining);
  const pct = total ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  return (
    <div className="glass rounded-2xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
        ) : (
          <button
            onClick={() => onToggle(e)}
            className="shrink-0"
            title="Marcar como paga (sem passar pelo histórico de movimentos)"
          >
            <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition" />
          </button>
        )}

        <div className={`rounded-full p-2 shrink-0 ${tab === "receber" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
          {tab === "receber" ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className={`font-medium truncate ${done ? "line-through text-muted-foreground" : ""}`}>
            {e.title || (tab === "pagar" ? "Dívida a Pagar" : "Dívida a Receber")}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {formatDate(e.event_date)}
            {e.bank_accounts && ` · ${e.bank_accounts.bank_name}`}
          </div>
        </div>

        <div className={`font-semibold text-right shrink-0 ${done ? "line-through text-muted-foreground" : tab === "receber" ? "text-success" : "text-destructive"}`}>
          {tab === "receber" ? "+" : "-"}{formatKz(remaining)}
        </div>

        <button
          onClick={() => onPayments(e)}
          className="text-muted-foreground hover:text-primary shrink-0"
          title="Registar movimento"
        >
          <History className="h-4 w-4" />
        </button>
      </div>

      {!done && (
        <div className="pl-8">
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-success rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Pago {formatKz(paid)} de {formatKz(total)} ({pct}%)
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentModal({ event, onClose }: { event: any | null; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [type, setType] = useState<"pagamento" | "aumento">("pagamento");
  const [amount, setAmount] = useState("");
  const [bankId, setBankId] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: banks } = useQuery({
    queryKey: ["bank_accounts", user?.id],
    enabled: !!user && !!event,
    queryFn: async () => (await supabase.from("bank_accounts").select("id, bank_name").order("bank_name")).data ?? [],
  });

  const { data: payments } = useQuery({
    queryKey: ["calendar_event_payments", event?.id],
    enabled: !!event,
    queryFn: async () =>
      (await supabase
        .from("calendar_event_payments")
        .select("*")
        .eq("event_id", event.id)
        .order("created_at", { ascending: false })
      ).data ?? [],
  });

  useEffect(() => {
    if (event) {
      setBankId(event.bank_account_id ?? "");
      setAmount("");
      setNote("");
      setType("pagamento");
    }
  }, [event?.id]);

  if (!event) return null;

  const remaining = event.remaining_amount ?? event.amount;
  const total = event.amount ?? 0;
  const paid = total - remaining;
  const isReceber = event.category === "divida_a_receber";

  const submit = async () => {
    const amt = parseNum(amount);
    if (amt <= 0) { toast.error("Valor obrigatório"); return; }
    if (!bankId) { toast.error("Selecione o banco"); return; }
    if (type === "pagamento" && amt > remaining) {
      toast.error(`O pagamento não pode exceder o valor em dívida (${formatKz(remaining)})`);
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("calendar_event_payments").insert({
      event_id: event.id,
      user_id: user!.id,
      bank_account_id: bankId,
      movement_type: type,
      amount: amt,
      note: note || null,
    } as never);
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success(type === "pagamento" ? "Pagamento registado" : "Aumento registado");
      setAmount("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["dividas"] });
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["bank_accounts"] });
      qc.invalidateQueries({ queryKey: ["calendar_event_payments", event.id] });
    }
  };

  const undoPayment = async (id: string) => {
    const { error } = await supabase.from("calendar_event_payments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Movimento revertido");
    qc.invalidateQueries({ queryKey: ["dividas"] });
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["bank_accounts"] });
    qc.invalidateQueries({ queryKey: ["calendar_event_payments", event.id] });
  };

  return (
    <Modal open={!!event} onClose={onClose} title={`Movimentos — ${event.title || (isReceber ? "Dívida a Receber" : "Dívida a Pagar")}`}>
      <div className="space-y-4">
        <div className="glass rounded-xl p-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span>{formatKz(total)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Pago</span><span className="text-success">{formatKz(paid)}</span></div>
          <div className="flex justify-between font-semibold"><span>Restante</span><span>{formatKz(remaining)}</span></div>
        </div>

        <div className="space-y-3">
          <Field label="Tipo de movimento">
            <SelectInput value={type} onChange={e => setType(e.target.value as any)}>
              <option value="pagamento">{isReceber ? "Recebi um pagamento" : "Paguei uma parte"}</option>
              <option value="aumento">{isReceber ? "Emprestei mais" : "A dívida aumentou"}</option>
            </SelectInput>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (Kz)">
              <TextInput inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="ex.: 5000" />
            </Field>
            <Field label="Banco">
              <SelectInput value={bankId} onChange={e => setBankId(e.target.value)}>
                <option value="">Selecionar...</option>
                {(banks ?? []).map((b: any) => <option key={b.id} value={b.id}>{b.bank_name}</option>)}
              </SelectInput>
            </Field>
          </div>
          <Field label="Nota (opcional)">
            <TextInput value={note} onChange={e => setNote(e.target.value)} placeholder="ex.: Devolveu metade em dinheiro" />
          </Field>
          <div className="flex justify-end">
            <PrimaryButton onClick={submit} disabled={loading || (remaining <= 0 && type === "pagamento")}>
              Registar
            </PrimaryButton>
          </div>
        </div>

        {(payments ?? []).length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Histórico</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {(payments ?? []).map((p: any) => (
                <div key={p.id} className="flex items-center gap-2 text-sm py-1.5 border-b border-border/50 last:border-0">
                  <span className={p.movement_type === "pagamento" ? "text-success" : "text-destructive"}>
                    {p.movement_type === "pagamento" ? "−" : "+"}{formatKz(p.amount)}
                  </span>
                  <span className="text-xs text-muted-foreground flex-1 truncate">
                    {p.note || (p.movement_type === "pagamento" ? "Pagamento" : "Aumento")} · {formatDate(p.created_at)}
                  </span>
                  <button onClick={() => undoPayment(p.id)} className="text-muted-foreground hover:text-destructive shrink-0" title="Reverter">
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
