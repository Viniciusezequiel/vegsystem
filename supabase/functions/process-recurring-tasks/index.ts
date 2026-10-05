import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function addDaysToDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Custom authorization: cron secret OR an authenticated admin user.
    // verify_jwt is disabled at the gateway because pg_cron authenticates
    // with x-cron-secret and legacy service-role JWTs are rejected there.
    const cronSecret = Deno.env.get("RECURRING_TASKS_CRON_SECRET");
    const providedSecret = req.headers.get("x-cron-secret");
    let authorized = !!cronSecret && providedSecret === cronSecret;

    if (!authorized) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const anonClient = createClient(
          supabaseUrl,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } },
        );
        const token = authHeader.replace("Bearer ", "");
        const { data: claims } = await anonClient.auth.getClaims(token);
        const userId = claims?.claims?.sub as string | undefined;
        if (userId) {
          const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: userId });
          authorized = !!isAdmin;
        }
      }
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tzNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const today = tzNow.toISOString().split("T")[0];
    const currentDayOfWeek = tzNow.getDay();
    const currentDayStr = String(currentDayOfWeek);

    const { data: recurringTasks, error: fetchError } = await supabase
      .from("tasks")
      .select("*")
      .not("recurrence_type", "is", null);

    if (fetchError) throw fetchError;

    if (!recurringTasks || recurringTasks.length === 0) {
      return new Response(
        JSON.stringify({ message: "No recurring tasks", created: 0, today, currentDayOfWeek }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let createdCount = 0;

    for (const task of recurringTasks) {
      const recurrenceType = task.recurrence_type as string;
      const recurrenceDays: string[] | null = task.recurrence_days || null;
      const lastRun: string | null = task.recurrence_last_run_date || null;

      if (lastRun === today) continue;

      let shouldCreate = false;

      if (recurrenceType === "daily") {
        shouldCreate = true;
      } else if (recurrenceType === "weekly") {
        if (recurrenceDays && recurrenceDays.length > 0) {
          shouldCreate = recurrenceDays.includes(currentDayStr);
        } else {
          const originalDay = new Date(task.created_at).getDay();
          if (currentDayOfWeek === originalDay) {
            if (!lastRun) {
              shouldCreate = true;
            } else {
              const daysSince = Math.floor(
                (tzNow.getTime() - new Date(lastRun + "T00:00:00").getTime()) / 86400000,
              );
              shouldCreate = daysSince >= 7;
            }
          }
        }
      } else if (recurrenceType === "monthly") {
        const originalDate = new Date(task.created_at).getDate();
        if (tzNow.getDate() === originalDate) {
          if (!lastRun || lastRun.slice(0, 7) !== today.slice(0, 7)) shouldCreate = true;
        }
      } else if (recurrenceType === "semiannual") {
        const orig = new Date(task.created_at);
        const monthsSince = (tzNow.getFullYear() - orig.getFullYear()) * 12 + (tzNow.getMonth() - orig.getMonth());
        if (monthsSince > 0 && monthsSince % 6 === 0 && tzNow.getDate() === orig.getDate()) {
          if (lastRun !== today) shouldCreate = true;
        }
      }

      if (!shouldCreate) continue;

      const { count: dupCount, error: dupError } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("recurrence_parent_id", task.id)
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`);

      if (dupError) throw dupError;
      if (dupCount && dupCount > 0) {
        await supabase.from("tasks").update({ recurrence_last_run_date: today }).eq("id", task.id);
        continue;
      }

      let newEventStart: string | null = null;
      let newEventEnd: string | null = null;
      if (task.event_start_datetime && task.event_end_datetime) {
        const origStart = new Date(task.event_start_datetime);
        const origEnd = new Date(task.event_end_datetime);
        const duration = origEnd.getTime() - origStart.getTime();
        const newStart = new Date(`${today}T${origStart.toISOString().slice(11, 19)}`);
        newEventStart = newStart.toISOString();
        newEventEnd = new Date(newStart.getTime() + duration).toISOString();
      }

      const dueDays = typeof task.recurrence_due_days === "number"
        ? task.recurrence_due_days
        : null;
      const newDueDate = dueDays !== null
        ? addDaysToDate(today, dueDays)
        : task.due_date
          ? today
          : null;

      const { error: insertError } = await supabase.from("tasks").insert({
        title: task.title,
        description: task.description,
        priority: task.priority,
        category: task.category,
        due_date: newDueDate,
        assigned_to: task.assigned_to,
        assigned_to_name: task.assigned_to_name,
        estimated_hours: task.estimated_hours,
        tags: task.tags,
        notes: task.notes,
        recurrence_type: null,
        recurrence_days: null,
        recurrence_due_days: null,
        recurrence_parent_id: task.id,
        event_start_datetime: newEventStart,
        event_end_datetime: newEventEnd,
        created_by_name: task.created_by_name || "Sistema (Recorrência)",
        status: "pending",
      });

      if (insertError) {
        console.error("Error creating recurring task:", insertError);
        continue;
      }

      await supabase.from("tasks").update({ recurrence_last_run_date: today }).eq("id", task.id);
      createdCount++;
    }

    return new Response(
      JSON.stringify({ message: "Processed", created: createdCount, today, currentDayOfWeek }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error processing recurring tasks:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
