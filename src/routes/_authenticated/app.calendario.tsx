import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDate, formatKz } from "@/lib/format";
import { PageHeader, PrimaryButton, GhostButton, Modal, Field, TextInput, SelectInput, SelectWithCustom } from "@/components/ui-kit";
import { Plus, Trash2, Calendar as CalIcon, CheckCircle2, Circle, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/calendario")({
  head: () => ({ meta: [{ title: "Calendário Financeiro — Azura Capital" }] }),
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
  const [open, setOpen] = useState(false);

  const { data: events } = useQuery({
    queryKey: ["events", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("calendar_events").select("*, bank_accounts(bank_name)").order("event_date")).data ?? [],
  });

  const today = new Date(new Date().toDateString());
  const pending = (events ?? []).filter((e: any) => e.status !== "efetuado");
  const upcoming = pending.filter((e: any) => new Date(e.event_date) >= today);
  const overdue = pending.filter((e: any) => new Date(e.event_date) < today);
  const done = (events ?? []).filter((e: any) => e.status === "efetuado");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["bank_accounts"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
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
      <PageHeader title="Calendário Financeiro" subtitle="Eventos, dívidas e despesas recorrentes" action={<PrimaryButton onClick={() => setOpen(true)}><Plus className="h-4 w-4 inline mr-1" /> Novo Evento</PrimaryButton>} />

      {noEvents ? (
        <div className="glass rounded-3xl p-12 text-center text-sm text-muted-foreground">Crie o primeiro evento para começar a organizar as suas datas financeiras.</div>
      ) : (
        <>
          <Section title="Em atraso" items={overdue} toggleStatus={toggleStatus} del={del} variant="overdue" />
          <Section title="Próximos" items={upcoming} toggleStatus={toggleStatus} del={del} />
          <Section title="Efetuados" items={done} toggleStatus={toggleStatus} del={del} muted />
        </>
      )}

      <EventModal open={open} onClose={() => { setOpen(false); invalidate(); }} />
    </div>
  );
}

function Section({ title, items, toggleStatus, del, muted, variant }: any) {
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${variant === "overdue" ? "text-destructive" : "text-muted-foreground"}`}>{title}</h2>
      <div className="space-y-2">
        {items.map((e: any) => (
          <div key={e.id} className={`glass rounded-2xl p-4 flex items-center gap-3 ${muted ? "opacity-70" : ""}`}>
            <button onClick={() => toggleStatus(e)} className="shrink-0" title={e.status === "efetuado" ? "Marcar como pendente" : "Marcar como efetuado"}>
              {e.status === "efetuado"
                ? <CheckCircle2 className="h-5 w-5 text-success" />
                : <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />}
            </button>
            <div className={`rounded-full p-2 shrink-0 ${e.direction === "receita" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
              {e.direction === "receita" ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{e.title || labelFor(e.category, e.custom_type)}</div>
              <div className="text-xs text-muted-foreground truncate">{labelFor(e.category, e.custom_type)} · {formatDate(e.event_date)}{e.bank_accounts && ` · ${e.bank_accounts.bank_name}`}</div>
            </div>
            <div className={`font-semibold text-right shrink-0 hidden sm:block ${e.direction === "receita" ? "text-success" : "text-destructive"}`}>
              {e.direction === "receita" ? "+" : "-"}{formatKz(e.amount ?? 0)}
            </div>
            <button onClick={() => del(e.id)} className="text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
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
        <Field label="Banco"><SelectInput value={form.bank_account_id} onChange={e => setForm({ ...form, bank_account_id: e.target.value })}>
          <option value="">Selecionar...</option>
          {(banks ?? []).map((b: any) => <option key={b.id} value={b.id}>{b.bank_name}</option>)}
        </SelectInput></Field>
        <p className="text-xs text-muted-foreground">Ao marcar como <b>efetuado</b>, o banco é {form.direction === "receita" ? "creditado" : "debitado"} automaticamente.</p>
        <div className="flex gap-2 justify-end pt-2">
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <PrimaryButton onClick={save} disabled={loading}>Guardar</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
