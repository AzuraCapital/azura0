import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDate, formatKz } from "@/lib/format";
import { PageHeader, PrimaryButton, GhostButton, Modal, Field, TextInput, SelectInput, SelectWithCustom } from "@/components/ui-kit";
import { Plus, Trash2, CheckCircle2, Circle, ArrowUpCircle, ArrowDownCircle, History, X as XIcon } from "lucide-react";
import { toast } from "sonner";

const CAL_URL = "https://azura0.lovable.app/app/calendario";
const CAL_TITLE = "Calendário Financeiro — Azura Capital";
const CAL_DESC = "Planeie eventos financeiros recorrentes com valor e banco associado; ao marcar efetuado o saldo é atualizado automaticamente.";

export const Route = createFileRoute("/_authenticated/app/calendario")({
  head: () => ({
    meta: [
      { title: CAL_TITLE },
      { name: "description", content: CAL_DESC },
      { property: "og", content: CAL_TITLE },
      { property: "og", content: CAL_DESC },
      { property: "og", content: CAL_URL },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [{ rel: "canonical", href: CAL_URL }],
  }),
  component: Page,
});

const EVENT_TYPES = [
  { value: "renda_casa", label: "Renda da Casa", dir: "despesa" },
  { value: "propina_escolar", label: "Propina Escolar", dir: "despesa" },
  { value: "seguro", label: "Seguro", dir: "despesa" },
  { value: "energia_agua", label: "Energia / Água", dir: "despesa" },
  { value: "internet", label: "Internet", dir: "despesa" },
  { value: "divida_a_pagar", label: "Dívida a Pagar", dir: "despesa" },
  { value: "divida_a_receber", label: "Dívida a Receber", dir: "receita" },
  { value: "dividendo", label: "Dividendo", dir: "receita" },
  { value: "vencimento", label: "Vencimento", dir: "receita" },
  { value: "pagamento", label: "Pagamento", dir: "despesa" },
] as const;

const DEBT_CATEGORIES = ["divida_a_pagar", "divida_a_receber"];
const isDebtEvent = (e: any) => DEBT_CATEGORIES.includes(e.category);

const parseNum = (s: string) => {
  const n = Number(String(s ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

function labelFor(category: string, custom?: string) {
  if (custom) return custom;
  return EVENT_TYPES.find(t => t.value === category)?.label ?? category;
}

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [paymentEvent, setPaymentEvent] = useState<any | null>(null);

  const { data: events } = useQuery({
    queryKey: ["events", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("calendar_events").select("*, bank_accounts(bank_name)").order("event_date")).data ?? [],
  });

  const today = new Date(new Date().toDateString());
  const openStatuses = (s: string) => s !== "efetuado" && s !== "quitada";
  const pending = (events ?? []).filter((e: any) => openStatuses(e.status));
  const upcoming = pending.filter((e: any) => new Date(e.event_date) >= today);
  const overdue = pending.filter((e: any) => new Date(e.event_date) < today);
  const done = (events ?? []).filter((e: any) => !openStatuses(e.status));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["bank_accounts"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["calendar_event_payments"] });
  };

  const del = async (id: string) => {
    await supabase.from("calendar_events").delete().eq("id", id);
    invalidate();
  };

  const toggleStatus = async (e: any) => {
    if (!user) return;
    const next = e.status === "efetuado" ? "pendente" : "efetuado";
    const { error } = await supabase.from("calendar_events").update({ status: next } as never).eq("id", e.id);
    if (error) toast.error(error.message);
    else toast.success(next === "efetuado" ? "Marcado como efetuado" : "Marcado como pendente");
    invalidate();
  };

  const noEvents = (events ?? []).length === 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Calendário Financeiro"
        subtitle="Eventos, dívidas e despesas recorrentes"
        action={
          <div className="flex gap-2">
            <GhostButton onClick={() => navigate({ to: "/app/dividas" })}>Gestão de Dívida</GhostButton>
            <PrimaryButton onClick={() => setOpen(true)}><Plus className="h-4 w-4 inline mr-1" /> Novo Evento</PrimaryButton>
          </div>
        }
      />

      {noEvents ? (
        <div className="glass rounded-3xl p-12 text-center text-sm text-muted-foreground">Crie o primeiro evento para começar a organizar as suas datas financeiras.</div>
      ) : (
        <>
          <Section title="Em atraso" items={overdue} toggleStatus={toggleStatus} del={del} onPayments={setPaymentEvent} variant="overdue" />
          <Section title="Próximos" items={upcoming} toggleStatus={toggleStatus} del={del} onPayments={setPaymentEvent} />
          <Section title="Concluídos" items={done} toggleStatus={toggleStatus} del={del} onPayments={setPaymentEvent} muted />
        </>
      )}

      <EventModal open={open} onClose={() => { setOpen(false); invalidate(); }} />
      <PaymentModal event={paymentEvent} onClose={() => { setPaymentEvent(null); invalidate(); }} />
    </div>
  );
}

function Section({ title, items, toggleStatus, del, onPayments, muted, variant }: any) {
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${variant === "overdue" ? "text-destructive" : "text-muted-foreground"}`}>{title}</h2>
      <div className="space-y-2">
        {items.map((e: any) => {
          const debt = isDebtEvent(e);
          const remaining = e.remaining_amount ?? e.amount;
          const paid = (e.amount ?? 0) - remaining;
          const pct = e.amount ? Math.min(100, Math.round((paid / e.amount) * 100)) : 0;

          return (
            <div key={e.id} className={`glass rounded-2xl p-4 flex flex-col gap-2 ${muted ? "opacity-70" : ""}`}>
              <div className="flex items-center gap-3">
                {debt ? (
                  e.status === "quitada" || e.status === "efetuado"
                    ? <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                    : <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                ) : (
                  <button onClick={() => toggleStatus(e)} className="shrink-0" title={e.status === "efetuado" ? "Marcar como pendente" : "Marcar como efetuado"}>
                    {e.status === "efetuado"
                      ? <CheckCircle2 className="h-5 w-5 text-success" />
                      : <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />}
                  </button>
                )}
                <div className={`rounded-full p-2 shrink-0 ${e.direction === "receita" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                  {e.direction === "receita" ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{e.title || labelFor(e.category, e.custom_type)}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {labelFor(e.category, e.custom_type)} · {formatDate(e.event_date)}{e.bank_accounts && ` · ${e.bank_accounts.bank_name}`}
                  </div>
                </div>
                <div className={`font-semibold text-right shrink-0 hidden sm:block ${e.direction === "receita" ? "text-success" : "text-destructive"}`}>
                  {debt ? formatKz(remaining) : `${e.direction === "receita" ? "+" : "-"}${formatKz(e.amount ?? 0)}`}
                </div>
                {debt && (
                  <button onClick={() => onPayments(e)} className="text-muted-foreground hover:text-primary shrink-0" title="Registar movimento">
                    <History className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => del(e.id)} className="text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="h-4 w-4" /></button>
              </div>

              {debt && (
                <div className="pl-8">
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-success rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Pago {formatKz(paid)} de {formatKz(e.amount ?? 0)} ({pct}%)
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    title: "",
    category: "renda_casa",
    custom_type: "",
    event_date: new Date().toISOString().slice(0, 10),
    amount: "",
    direction: "despesa" as "despesa" | "receita",
    bank_account_id: "",
  });
  const [loading, setLoading] = useState(false);

  const { data: banks } = useQuery({
    queryKey: ["bank_accounts", user?.id],
    enabled: !!user && open,
    queryFn: async () => (await supabase.from("bank_accounts").select("id, bank_name").order("bank_name")).data ?? [],
  });

  const isCustom = form.custom_type !== "";

  const onTypeChange = (v: string) => {
    if (v === " " || isCustom) {
      setForm({ ...form, category: "outro", custom_type: v });
    } else {
      const def = EVENT_TYPES.find(t => t.value === v);
      setForm({ ...form, category: v, custom_type: "", direction: ((def?.dir as any) ?? "despesa") });
    }
  };

  const save = async () => {
    const amt = parseNum(form.amount);
    if (!user || !form.event_date) { toast.error("Indique a data"); return; }
    if (amt <= 0) { toast.error("Valor obrigatório"); return; }
    if (!form.bank_account_id) { toast.error("Selecione o banco"); return; }
    if (isCustom && !form.custom_type.trim()) { toast.error("Indique o tipo personalizado"); return; }
    setLoading(true);
    const { error } = await supabase.from("calendar_events").insert({
      user_id: user.id,
      title: form.title || labelFor(form.category, form.custom_type),
      category: form.category,
      custom_type: isCustom ? form.custom_type.trim() : null,
      event_date: form.event_date,
      amount: amt,
      direction: form.direction,
      bank_account_id: form.bank_account_id,
      status: "pendente",
    } as never);
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Evento criado");
      setForm({ title: "", category: "renda_casa", custom_type: "", event_date: new Date().toISOString().slice(0, 10), amount: "", direction: "despesa", bank_account_id: "" });
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Novo Evento">
      <div className="space-y-3">
        <SelectWithCustom
          label="Tipo"
          value={isCustom ? form.custom_type : form.category}
          onChange={onTypeChange}
          options={EVENT_TYPES.map(t => ({ value: t.value, label: t.label }))}
          customLabel="Outro..."
        />
        <Field label="Título (opcional)"><TextInput value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Renda de Julho" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data"><TextInput type="date" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} /></Field>
          <Field label="Valor (Kz)"><TextInput inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="ex.: 15000" /></Field>
        </div>
        <Field label="Movimento">
          <SelectInput value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value as any })}>
            <option value="despesa">Despesa</option>
            <option value="receita">Receita</option>
          </SelectInput>
        </Field>
        <Field label="Banco">
          <SelectInput value={form.bank_account_id} onChange={e => setForm({ ...form, bank_account_id: e.target.value })}>
            <option value="">Selecionar...</option>
            {(banks ?? []).map((b: any) => <option key={b.id} value={b.id}>{b.bank_name}</option>)}
          </SelectInput>
        </Field>
        <p className="text-xs text-muted-foreground">Ao marcar como <b>efetuado</b>, o banco é {form.direction === "receita" ? "creditado" : "debitado"} automaticamente.</p>
        <div className="flex gap-2 justify-end pt-2">
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <PrimaryButton onClick={save} disabled={loading}>Guardar</PrimaryButton>
        </div>
      </div>
    </Modal>
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
    queryFn: async () => (await supabase.from("calendar_event_payments").select("*").eq("event_id", event.id).order("created_at", { ascending: false })).data ?? [],
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
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["bank_accounts"] });
      qc.invalidateQueries({ queryKey: ["calendar_event_payments", event.id] });
    }
  };

  const undoPayment = async (id: string) => {
    const { error } = await supabase.from("calendar_event_payments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Movimento revertido");
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["bank_accounts"] });
    qc.invalidateQueries({ queryKey: ["calendar_event_payments", event.id] });
  };

  return (
    <Modal open={!!event} onClose={onClose} title={`Movimentos — ${event.title || labelFor(event.category, event.custom_type)}`}>
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
            <Field label="Valor (Kz)"><TextInput inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="ex.: 5000" /></Field>
            <Field label="Banco">
              <SelectInput value={bankId} onChange={e => setBankId(e.target.value)}>
                <option value="">Selecionar...</option>
                {(banks ?? []).map((b: any) => <option key={b.id} value={b.id}>{b.bank_name}</option>)}
              </SelectInput>
            </Field>
          </div>
          <Field label="Nota (opcional)"><TextInput value={note} onChange={e => setNote(e.target.value)} placeholder="ex.: Devolveu metade em dinheiro" /></Field>
          <div className="flex justify-end">
            <PrimaryButton onClick={submit} disabled={loading || remaining <= 0 && type === "pagamento"}>Registar</PrimaryButton>
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
                  <span className="text-xs text-muted-foreground flex-1 truncate">{p.note || (p.movement_type === "pagamento" ? "Pagamento" : "Aumento")} · {formatDate(p.created_at)}</span>
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
