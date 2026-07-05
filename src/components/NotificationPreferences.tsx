import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type Prefs = {
  user_id: string;
  aviso_previo: boolean;
  no_dia: boolean;
  atrasado: boolean;
};

const DEFAULT_PREFS: Omit<Prefs, "user_id"> = {
  aviso_previo: true,
  no_dia: true,
  atrasado: true,
};

const LABELS: Record<keyof typeof DEFAULT_PREFS, string> = {
  aviso_previo: "Aviso prévio (3 dias antes)",
  no_dia: "No dia do vencimento",
  atrasado: "Lembrete diário de atraso",
};

export function NotificationPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: prefs } = useQuery({
    queryKey: ["notification_preferences", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as Prefs) ?? { user_id: user!.id, ...DEFAULT_PREFS };
    },
  });

  const toggle = async (key: keyof typeof DEFAULT_PREFS) => {
    if (!prefs || !user) return;
    const updated = { ...prefs, [key]: !prefs[key] };
    qc.setQueryData(["notification_preferences", user.id], updated);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: user.id, aviso_previo: updated.aviso_previo, no_dia: updated.no_dia, atrasado: updated.atrasado } as never);
    if (error) {
      console.error("Erro ao guardar preferência:", error);
      qc.invalidateQueries({ queryKey: ["notification_preferences", user.id] });
    }
  };

  if (!prefs) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Notificações do calendário</h3>
      {(Object.keys(DEFAULT_PREFS) as Array<keyof typeof DEFAULT_PREFS>).map((key) => (
        <div key={key} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
          <span className="text-sm">{LABELS[key]}</span>
          <button
            onClick={() => toggle(key)}
            role="switch"
            aria-checked={prefs[key]}
            className={`relative w-11 h-6 rounded-full transition ${prefs[key] ? "bg-primary" : "bg-secondary"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                prefs[key] ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      ))}
    </div>
  );
}
