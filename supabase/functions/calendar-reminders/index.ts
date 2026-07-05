import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REMINDER_DAYS = 3;
const TZ_OFFSET_HOURS = 1; // Africa/Luanda = UTC+1, sem DST
const RETENTION_DAYS = 90; // apaga notificações mais antigas que isto, sem exceção

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

  // ---------- LIMPEZA (roda sempre, antes de criar novas) ----------

  // 1. Esconde notificações de eventos já resolvidos (não apaga, só deixa de mostrar)
  const { data: resolvedEvents, error: resolvedErr } = await supabase
    .from("calendar_events")
    .select("id")
    .in("status", ["efetuado", "quitada"]);

  if (resolvedErr) {
    console.error("Erro ao buscar eventos resolvidos:", resolvedErr);
  } else if ((resolvedEvents ?? []).length > 0) {
    const resolvedIds = resolvedEvents.map((e) => e.id);
    const { error: hideErr } = await supabase
      .from("notifications")
      .update({ is_active: false })
      .in("related_event_id", resolvedIds)
      .eq("is_active", true);
    if (hideErr) console.error("Erro ao esconder notificações resolvidas:", hideErr);
  }

  // 2. Apaga definitivamente notificações com mais de RETENTION_DAYS dias
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffStr = toDateStr(cutoff);
  const { error: purgeErr } = await supabase
    .from("notifications")
    .delete()
    .lt("notify_date", cutoffStr);
  if (purgeErr) console.error("Erro na limpeza de notificações antigas:", purgeErr);

  // ---------- GERAÇÃO DE NOVAS NOTIFICAÇÕES ----------

  const { data: events, error } = await supabase
    .from("calendar_events")
    .select("id, user_id, event_date, status")
    .not("status", "in", "(efetuado,quitada)")
    .lte("event_date", windowEndStr);

  if (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // Carrega preferências de todos os utilizadores de uma vez (evita N queries)
  const { data: prefsData, error: prefsErr } = await supabase
    .from("notification_preferences")
    .select("*");
  if (prefsErr) console.error("Erro ao buscar preferências:", prefsErr);
  const prefsMap = new Map((prefsData ?? []).map((p) => [p.user_id, p]));

  let created = 0;
  let skippedByPreference = 0;

  for (const e of events ?? []) {
    const isOverdue = e.event_date < todayStr;
    const isToday = e.event_date === todayStr;

    const eventDate = new Date(e.event_date + "T00:00:00Z");
    const todayDate = new Date(todayStr + "T00:00:00Z");
    const diffDays = Math.round((eventDate.getTime() - todayDate.getTime()) / 86400000);

    const alertType: "atrasado" | "no_dia" | "aviso_previo" = isOverdue
      ? "atrasado"
      : isToday
      ? "no_dia"
      : "aviso_previo";
    const leadDays = diffDays;

    // Respeita a preferência do utilizador — se desligou este tipo, nem cria a linha
    const userPrefs = prefsMap.get(e.user_id);
    const allowed = userPrefs ? userPrefs[alertType] !== false : true; // sem registo = tudo ligado por defeito
    if (!allowed) {
      skippedByPreference++;
      continue;
    }

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

  return new Response(
    JSON.stringify({ notified: created, skipped_by_preference: skippedByPreference }),
    { headers: { "Content-Type": "application/json" } },
  );
});
