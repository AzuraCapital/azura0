import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { PageHeader, PrimaryButton, GhostButton, Modal, Field, TextInput, SelectInput, TextArea } from "@/components/ui-kit";
import { Plus, Trash2, Calendar as CalIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/calendario")({
  head: () => ({ meta: [{ title: "Calendário — Azura Capital" }] }),
  component: Page,
});

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: events } = useQuery({
    queryKey: ["events", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("calendar_events").select("*").order("event_date")).data ?? [],
  });

  const upcoming = (events ?? []).filter((e: any) => new Date(e.event_date) >= new Date(new Date().toDateString()));
  const past = (events ?? []).filter((e: any) => new Date(e.event_date) < new Date(new Date().toDateString()));

  const del = async (id: string) => {
    await supabase.from("calendar_events").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["events"] });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader title="Calendário Financeiro" subtitle="Eventos, dividendos e vencimentos" action={<PrimaryButton onClick={() => setOpen(true)}><Plus className="h-4 w-4 inline mr-1" /> Novo Evento</PrimaryButton>} />

      <Section title="Próximos" items={upcoming} del={del} />
      <Section title="Passados" items={past} del={del} muted />

      <EventModal open={open} onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["events"] }); }} />
    </div>
  );
}

function Section({ title, items, del, muted }: any) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</h2>
      {items.length === 0 ? (
        <div className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">Sem eventos</div>
      ) : (
        <div className="space-y-2">
          {items.map((e: any) => (
            <div key={e.id} className={`glass rounded-2xl p-4 flex items-center gap-4 ${muted ? "opacity-60" : ""}`}>
              <div className="rounded-full p-2.5 bg-primary/10 text-primary"><CalIcon className="h-4 w-4" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{e.title}</div>
                <div className="text-xs text-muted-foreground capitalize">{e.event_type?.replace(/_/g, " ")} · {formatDate(e.event_date)}</div>
              </div>
              <button onClick={() => del(e.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EventModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ title: "", event_type: "outro", event_date: "", description: "" });
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!user || !form.title || !form.event_date) { toast.error("Preencha os campos obrigatórios"); return; }
    setLoading(true);
    const { error } = await supabase.from("calendar_events").insert({
      user_id: user.id,
      title: form.title,
      event_type: form.event_type,
      event_date: form.event_date,
      description: form.description || null,
    } as never);
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Evento criado"); onClose(); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Novo Evento">
      <div className="space-y-3">
        <Field label="Título"><TextInput value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Tipo"><SelectInput value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })}>
          <option value="dividendo">Dividendo</option>
          <option value="vencimento">Vencimento</option>
          <option value="reuniao">Reunião</option>
          <option value="pagamento">Pagamento</option>
          <option value="outro">Outro</option>
        </SelectInput></Field>
        <Field label="Data"><TextInput type="date" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} /></Field>
        <Field label="Descrição"><TextArea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
        <div className="flex gap-2 justify-end pt-2">
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <PrimaryButton onClick={save} disabled={loading}>Guardar</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
