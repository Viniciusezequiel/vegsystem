import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const today = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const currentDayOfWeek = now.getDay(); // 0=Sunday ... 6=Saturday

    // Fetch all completed recurring tasks
    const { data: completedRecurring, error: fetchError } = await supabase
      .from("tasks")
      .select("*")
      .eq("status", "completed")
      .not("recurrence_type", "is", null);

    if (fetchError) {
      throw fetchError;
    }

    if (!completedRecurring || completedRecurring.length === 0) {
      return new Response(
        JSON.stringify({ message: "No recurring tasks to process", created: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let createdCount = 0;

    for (const task of completedRecurring) {
      const completedAt = task.completed_at ? new Date(task.completed_at) : new Date(task.updated_at);
      const recurrenceType = task.recurrence_type;

      let shouldCreate = false;
      let newDueDate: string | null = null;
      let newEventStart: string | null = null;
      let newEventEnd: string | null = null;

      if (recurrenceType === "weekly") {
        // Create on same day of week as original was created
        const originalCreatedDay = new Date(task.created_at).getDay();
        if (currentDayOfWeek === originalCreatedDay) {
          // Check if we already created one this week
          const weekStart = new Date(now);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          weekStart.setHours(0, 0, 0, 0);

          const { count } = await supabase
            .from("tasks")
            .select("*", { count: "exact", head: true })
            .eq("title", task.title)
            .eq("recurrence_type", "weekly")
            .eq("status", "pending")
            .gte("created_at", weekStart.toISOString());

          if (!count || count === 0) {
            shouldCreate = true;
            // Set due date to 7 days from now if original had a due date
            if (task.due_date) {
              const due = new Date(today);
              due.setDate(due.getDate() + 7);
              newDueDate = due.toISOString().split("T")[0];
            }
          }
        }
      } else if (recurrenceType === "monthly") {
        const originalCreatedDate = new Date(task.created_at).getDate();
        if (now.getDate() === originalCreatedDate) {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

          const { count } = await supabase
            .from("tasks")
            .select("*", { count: "exact", head: true })
            .eq("title", task.title)
            .eq("recurrence_type", "monthly")
            .eq("status", "pending")
            .gte("created_at", monthStart.toISOString());

          if (!count || count === 0) {
            shouldCreate = true;
            if (task.due_date) {
              const due = new Date(today);
              due.setMonth(due.getMonth() + 1);
              newDueDate = due.toISOString().split("T")[0];
            }
          }
        }
      } else if (recurrenceType === "semiannual") {
        const originalCreated = new Date(task.created_at);
        const monthsSinceCreated = (now.getFullYear() - originalCreated.getFullYear()) * 12 + (now.getMonth() - originalCreated.getMonth());
        
        if (monthsSinceCreated > 0 && monthsSinceCreated % 6 === 0 && now.getDate() === originalCreated.getDate()) {
          const semesterStart = new Date(now.getFullYear(), now.getMonth(), 1);

          const { count } = await supabase
            .from("tasks")
            .select("*", { count: "exact", head: true })
            .eq("title", task.title)
            .eq("recurrence_type", "semiannual")
            .eq("status", "pending")
            .gte("created_at", semesterStart.toISOString());

          if (!count || count === 0) {
            shouldCreate = true;
            if (task.due_date) {
              const due = new Date(today);
              due.setMonth(due.getMonth() + 6);
              newDueDate = due.toISOString().split("T")[0];
            }
          }
        }
      }

      if (shouldCreate) {
        // Shift event datetimes if they exist
        if (task.event_start_datetime && task.event_end_datetime) {
          const origStart = new Date(task.event_start_datetime);
          const origEnd = new Date(task.event_end_datetime);
          const diff = recurrenceType === "weekly" ? 7 : recurrenceType === "monthly" ? 30 : 180;
          
          const newStart = new Date(origStart);
          newStart.setDate(newStart.getDate() + diff);
          const newEnd = new Date(origEnd);
          newEnd.setDate(newEnd.getDate() + diff);
          
          newEventStart = newStart.toISOString();
          newEventEnd = newEnd.toISOString();
        }

        const { error: insertError } = await supabase.from("tasks").insert({
          title: task.title,
          description: task.description,
          priority: task.priority,
          category: task.category,
          due_date: newDueDate || task.due_date,
          assigned_to: task.assigned_to,
          assigned_to_name: task.assigned_to_name,
          estimated_hours: task.estimated_hours,
          tags: task.tags,
          notes: task.notes,
          recurrence_type: task.recurrence_type,
          event_start_datetime: newEventStart,
          event_end_datetime: newEventEnd,
          created_by_name: task.created_by_name || "Sistema (Recorrência)",
          status: "pending",
        });

        if (!insertError) {
          createdCount++;
        } else {
          console.error("Error creating recurring task:", insertError);
        }
      }
    }

    return new Response(
      JSON.stringify({ message: `Processed recurring tasks`, created: createdCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing recurring tasks:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
