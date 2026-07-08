import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDate, formatKz } from "@/lib/format";
import { Bell, X as XIcon } from "lucide-react";

export function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async () =>
      (await supabase
        .from("notifications")
        .select("*, calendar_events(title, amount, remaining_amount, event_date, direction, category)")
        .eq("channel", "app")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(30)
      ).data ?? [],
  });

  const unread = (notifications ?? []).filter((n: any) => !n.read_at).length;

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() } as never).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const markAllRead = async () => {
    const ids = (notifications ?? []).filter((n: any) => !n.read_at).map((n: any) => n.id);
    if (ids.length === 0) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() } as never).in("id", ids);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const describe = (n: any) => {
    const ev = n.calendar_events;
    const nome = ev?.title || "Evento financeiro";
    const valor = ev?.remaining_amount ?? ev?.amount ?? 0;
    const isReceita = ev?.direction === "receita";

    if (n.alert_type === "atrasado") {
      return {
        title: `Em atraso: ${nome}`,
        msg: `${formatKz(valor)} ${isReceita ? "ainda não foi recebido" : "continua por regularizar"}, previsto para ${ev ? formatDate(ev.event_date) : ""}.`,
      };
    }
    if (n.alert_type === "no_dia") {
      return {
        title: `${isReceita ? "A receber hoje" : "Vence hoje"}: ${nome}`,
        msg: `${formatKz(valor)} ${isReceita ? "previsto para receber hoje" : "vence hoje"}, ${ev ? formatDate(ev.event_date) : ""}.`,
      };
    }
    return {
      title: `${isReceita ? "A receber em" : "Vence em"} ${n.lead_days} dia${n.lead_days === 1 ? "" : "s"}: ${nome}`,
      msg: `${formatKz(valor)} ${isReceita ? "previsto para receber" : "vence"} em ${n.lead_days} dia${n.lead_days === 1 ? "" : "s"}, no dia ${ev ? formatDate(ev.event_date) : ""}.`,
    };
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="relative rounded-full p-2 hover:bg-secondary transition">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-white text-[10px] flex items-center justify-center font-semibold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-1rem))] max-h-[70vh] overflow-y-auto rounded-2xl shadow-2xl z-50 divide-y divide-border bg-popover text-popover-foreground border border-border">
            <div className="p-3 flex items-center justify-between sticky top-0 bg-popover border-b border-border">
              <span className="text-sm font-semibold">Notificações</span>
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-primary hover:underline">Marcar todas como lidas</button>
              )}
            </div>
            {(notifications ?? []).length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Sem notificações.</div>
            ) : (
              (notifications ?? []).map((n: any) => {
                const { title, msg } = describe(n);
                return (
                  <div key={n.id} className={`p-3 flex items-start gap-2 ${!n.read_at ? "bg-primary/5" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{title}</div>
                      <div className="text-xs text-muted-foreground">{msg}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">{formatDate(n.created_at)}</div>
                    </div>
                    {!n.read_at && (
                      <button onClick={() => markRead(n.id)} className="text-muted-foreground hover:text-primary shrink-0" title="Marcar como lida">
                        <XIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
