import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REMINDER_DAYS = 3;
const TZ_OFFSET_HOURS = 1; // Africa/Luanda = UTC+1, sem DST

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function todayInLuanda(): Date {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + TZ_OFFSET_HOURS * 3600000);
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

Deno.serve(async () => {
  const today = todayInLuanda();
  const todayStr = toDateStr(today);
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + REMINDER_DAYS);
  const windowEndStr = toDateStr(windowEnd);

  const { data: events, error } = await supabase
    .from("calendar_events")
    .select("id, user_id, event_date, status")
    .not("status", "in", "(efetuado,quitada)")
    .lte("event_date", windowEndStr);

  if (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let created = 0;

  for (const e of events ?? []) {
    const isOverdue = e.event_date < todayStr;
    const isToday = e.event_date === todayStr;

    // Distância real em dias — não assume constante fixa
    const eventDate = new Date(e.event_date + "T00:00:00Z");
    const todayDate = new Date(todayStr + "T00:00:00Z");
    const diffDays = Math.round((eventDate.getTime() - todayDate.getTime()) / 86400000);

    const alertType = isOverdue ? "atrasado" : isToday ? "no_dia" : "aviso_previo";
    const leadDays = diffDays;

    // notify_date garante 1 notificação por dia por evento+tipo+canal,
    // em vez de bloquear repetição para sempre
    const { error: appErr } = await supabase.from("notifications").insert({
      user_id: e.user_id,
      related_event_id: e.id,
      alert_type: alertType,
      channel: "app",
      lead_days: leadDays,
      is_active: true,
      notify_date: todayStr,
    });

    if (!appErr) created++;
    else if (appErr.code !== "23505") console.error("Insert falhou:", appErr);
  }

  return new Response(JSON.stringify({ notified: created }), {
    headers: { "Content-Type": "application/json" },
  });
});
