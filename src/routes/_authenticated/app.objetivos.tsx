import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatKz, formatDate } from "@/lib/format";
import { PageHeader, PrimaryButton, GhostButton, Modal, Field, TextInput, TextArea } from "@/components/ui-kit";
import { Plus, Trash2, Target, Star } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/objetivos")({
  head: () => ({ meta: [{ title: "Objetivos — Azura Capital" }] }),
  component: Page,
});

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: goals } = useQuery({
    queryKey: ["goals", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("goals").select("*").order("is_primary", { ascending: false })).data ?? [],
  });

  const del = async (id: string) => {
    await supabase.from("goals").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["goals"] });
  };

  const togglePrimary = async (id: string) => {
    await supabase.from("goals").update({ is_primary: false } as never).neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("goals").update({ is_primary: true } as never).eq("id", id);
    qc.invalidateQueries({ queryKey: ["goals"] });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader title="Objetivos" subtitle="Metas patrimoniais" action={<PrimaryButton onClick={() => setOpen(true)}><Plus className="h-4 w-4 inline mr-1" /> Novo Objetivo</PrimaryButton>} />

      <div className="grid gap-4 md:grid-cols-2">
        {(goals ?? []).length === 0 && <div className="glass rounded-3xl p-12 text-center text-sm text-muted-foreground md:col-span-2">Sem objetivos. Defina a sua primeira meta.</div>}
        {(goals ?? []).map((g: any) => {
          const pct = Math.min(100, (Number(g.current_amount) / Number(g.target_amount)) * 100);
          return (
            <div key={g.id} className="glass rounded-3xl p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-full p-2 bg-primary/10 text-primary"><Target className="h-4 w-4" /></div>
                  <div>
                    <div className="font-semibold flex items-center gap-2">{g.name} {g.is_primary && <Star className="h-4 w-4 fill-primary text-primary" />}</div>
                    {g.description && <div className="text-sm text-muted-foreground">{g.description}</div>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => togglePrimary(g.id)} className="text-muted-foreground hover:text-primary p-1" title="Marcar como principal"><Star className="h-4 w-4" /></button>
                  <button onClick={() => del(g.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">{formatKz(g.current_amount)}</span>
                  <span className="font-semibold">{formatKz(g.target_amount)}</span>
                </div>
                <div className="h-3 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full gradient-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>{pct.toFixed(0)}% concluído</span>
                  {g.target_date && <span>até {formatDate(g.target_date)}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <GoalModal open={open} onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["goals"] }); }} />
    </div>
  );
}

function GoalModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: "", description: "", target_amount: "", current_amount: "", target_date: "" });
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!user || !form.name || !form.target_amount) { toast.error("Preencha os campos obrigatórios"); return; }
    setLoading(true);
    const { error } = await supabase.from("goals").insert({
      user_id: user.id,
      name: form.name,
      description: form.description || null,
      target_amount: Number(form.target_amount),
      current_amount: Number(form.current_amount) || 0,
      target_date: form.target_date || null,
    } as never);
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Objetivo criado"); onClose(); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Novo Objetivo">
      <div className="space-y-3">
        <Field label="Nome"><TextInput value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Casa, Reserva..." /></Field>
        <Field label="Descrição"><TextArea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Meta (Kz)"><TextInput type="number" value={form.target_amount} onChange={e => setForm({ ...form, target_amount: e.target.value })} /></Field>
          <Field label="Atual (Kz)"><TextInput type="number" value={form.current_amount} onChange={e => setForm({ ...form, current_amount: e.target.value })} /></Field>
        </div>
        <Field label="Data alvo"><TextInput type="date" value={form.target_date} onChange={e => setForm({ ...form, target_date: e.target.value })} /></Field>
        <div className="flex gap-2 justify-end pt-2">
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <PrimaryButton onClick={save} disabled={loading}>Guardar</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
