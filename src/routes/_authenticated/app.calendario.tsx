import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDate, formatKz } from "@/lib/format";
import { PageHeader, PrimaryButton, GhostButton, Modal, Field, TextInput, SelectInput, TextArea, SelectWithCustom } from "@/components/ui-kit";
import { Plus, Trash2, Calendar as CalIcon, CheckCircle2, Circle, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/calendario")({
  head: () => ({ meta: [{ title: "Calendário — Azura Capital" }] }),
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
  { value: "reuniao", label: "Reunião", dir: "neutro" },
] as const;

function labelFor(type: string, custom?: string) {
  if (custom) return custom;
  return EVENT_TYPES.find(t => t.value === type)?.label ?? type;
}

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: events } = useQuery({
    queryKey: ["events", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("calendar_events").select("*").order("event_date")).data ?? [],
  });

  const today = new Date(new Date().toDateString());
  const pending = (events ?? []).filter((e: any) => e.status !== "efetuado");
  const upcoming = pending.filter((e: any) => new Date(e.event_date) >= today);
  const overdue = pending.filter((e: any) => new Date(e.event_date) < today);
  const done = (events ?? []).filter((e: any) => e.status === "efetuado");

  const del = async (id: string) => {
    await supabase.from("calendar_events").delete().eq("id", id);
    await supabase.from("transactions").delete().eq("source_event_id", id);
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  const toggleStatus = async (e: any) => {
    if (!user) return;
    if (e.status === "efetuado") {
      // desfazer
      await supabase.from("transactions").delete().eq("source_event_id", e.id);
      await supabase.from("calendar_events").update({ status: "pendente" } as never).eq("id", e.id);
      toast.success("Marcado como não efetuado");
    } else {
      // efetuar — cria transação se tiver valor + direção
      await supabase.from("calendar_events").update({ status: "efetuado" } as never).eq("id", e.id);
      if (e.amount && (e.direction === "despesa" || e.direction === "receita")) {
        const payload: any = {
          user_id: user.id,
          type: e.direction,
          amount: Number(e.amount),
          description: labelFor(e.event_type, e.custom_type) + (e.title ? ` — ${e.title}` : ""),
          transaction_date: e.event_date,
          source_event_id: e.id,
        };
        await supabase.from("transactions").insert(payload as never);
      }
      toast.success("Marcado como efetuado");
    }
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader title="Calendário Financeiro" subtitle="Eventos, dívidas, despesas recorrentes" action={<PrimaryButton onClick={() => setOpen(true)}><Plus className="h-4 w-4 inline mr-1" /> Novo Evento</PrimaryButton>} />

      <Section title="Em atraso" items={overdue} toggleStatus={toggleStatus} del={del} variant="overdue" />
      <Section title="Próximos" items={upcoming} toggleStatus={toggleStatus} del={del} />
      <Section title="Efetuados" items={done} toggleStatus={toggleStatus} del={del} muted />

      <EventModal open={open} onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["events"] }); }} />
    </div>
  );
}

function Section({ title, items, toggleStatus, del, muted, variant }: any) {
  if (items.length === 0 && variant !== "overdue") {
    return (
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</h2>
        <div className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">Sem eventos</div>
      </div>
    );
  }
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${variant === "overdue" ? "text-destructive" : "text-muted-foreground"}`}>{title}</h2>
      <div className="space-y-2">
        {items.map((e: any) => (
          <div key={e.id} className={`glass rounded-2xl p-4 flex items-center gap-3 ${muted ? "opacity-70" : ""}`}>
            <button onClick={() => toggleStatus(e)} className="shrink-0" title={e.status === "efetuado" ? "Marcar como não efetuado" : "Marcar como efetuado"}>
              {e.status === "efetuado"
                ? <CheckCircle2 className="h-5 w-5 text-success" />
                : <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />}
            </button>
            <div className={`rounded-full p-2 shrink-0 ${e.direction === "receita" ? "bg-success/10 text-success" : e.direction === "despesa" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
              {e.direction === "receita" ? <ArrowUpCircle className="h-4 w-4" /> : e.direction === "despesa" ? <ArrowDownCircle className="h-4 w-4" /> : <CalIcon className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{e.title || labelFor(e.event_type, e.custom_type)}</div>
              <div className="text-xs text-muted-foreground truncate">{labelFor(e.event_type, e.custom_type)} · {formatDate(e.event_date)}</div>
            </div>
            {e.amount != null && (
              <div className={`font-semibold text-right shrink-0 hidden sm:block ${e.direction === "receita" ? "text-success" : e.direction === "despesa" ? "text-destructive" : ""}`}>
                {e.direction === "receita" ? "+" : e.direction === "despesa" ? "-" : ""}{formatKz(e.amount)}
              </div>
            )}
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
    event_type: "renda_casa",
    custom_type: "",
    event_date: "",
    description: "",
    amount: "",
    direction: "despesa" as "despesa" | "receita" | "neutro",
  });
  const [loading, setLoading] = useState(false);

  // Auto-ajustar direção quando muda tipo (a não ser que seja "personalizado")
  const onTypeChange = (v: string) => {
    if (v === "__custom__") {
      setForm({ ...form, event_type: "outro", custom_type: form.custom_type || " " });
    } else {
      const def = EVENT_TYPES.find(t => t.value === v);
      setForm({ ...form, event_type: v, custom_type: "", direction: (def?.dir as any) ?? "neutro" });
    }
  };

  const isCustom = form.custom_type !== "";

  const save = async () => {
    if (!user || !form.event_date) { toast.error("Indique a data"); return; }
    if (isCustom && !form.custom_type.trim()) { toast.error("Indique o tipo personalizado"); return; }
    setLoading(true);
    const { error } = await supabase.from("calendar_events").insert({
      user_id: user.id,
      title: form.title || labelFor(form.event_type, form.custom_type),
      event_type: form.event_type,
      custom_type: isCustom ? form.custom_type.trim() : null,
      event_date: form.event_date,
      description: form.description || null,
      amount: form.amount ? Number(form.amount) : null,
      direction: form.direction,
      status: "pendente",
    } as never);
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Evento criado");
      setForm({ title: "", event_type: "renda_casa", custom_type: "", event_date: "", description: "", amount: "", direction: "despesa" });
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Novo Evento">
      <div className="space-y-3">
        <SelectWithCustom
          label="Tipo"
          value={isCustom ? form.custom_type : form.event_type}
          onChange={(v) => {
            // Se o utilizador estava em custom e está a escrever, atualiza custom_type
            if (isCustom || v === " ") {
              setForm({ ...form, event_type: "outro", custom_type: v });
            } else {
              onTypeChange(v);
            }
          }}
          options={EVENT_TYPES.map(t => ({ value: t.value, label: t.label }))}
          customLabel="Personalizado..."
        />
        <Field label="Título (opcional)"><TextInput value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Renda de Julho" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data"><TextInput type="date" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} /></Field>
          <Field label="Valor (Kz, opcional)"><TextInput type="number" step="any" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></Field>
        </div>
        <Field label="Movimento">
          <SelectInput value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value as any })}>
            <option value="despesa">Despesa</option>
            <option value="receita">Receita</option>
            <option value="neutro">Sem movimento</option>
          </SelectInput>
        </Field>
        <Field label="Descrição"><TextArea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
        <p className="text-xs text-muted-foreground">Ao marcar como <b>efetuado</b>, o valor é registado automaticamente como {form.direction === "receita" ? "receita" : "despesa"} no histórico.</p>
        <div className="flex gap-2 justify-end pt-2">
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <PrimaryButton onClick={save} disabled={loading}>Guardar</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
