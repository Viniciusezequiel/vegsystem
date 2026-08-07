import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---- Authentication: only signed-in internal users may trigger emails ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth
      .getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (claimsError || !userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: isInternal } = await admin.rpc("is_internal_user", {
      _user_id: userId,
    });
    if (!isInternal) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Input validation: only a task id is accepted ----
    const body = await req.json().catch(() => ({}));
    const taskId = typeof body?.taskId === "string" ? body.taskId.trim() : "";
    if (!UUID_RE.test(taskId)) {
      return new Response(JSON.stringify({ error: "Invalid taskId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    // ---- Everything below is derived server-side, never from the caller ----
    const { data: task, error: taskError } = await admin
      .from("tasks")
      .select(
        "id, title, description, category, priority, due_date, assigned_to, assigned_to_name, created_by_name, event_start_datetime, event_end_datetime",
      )
      .eq("id", taskId)
      .maybeSingle();

    if (taskError) throw taskError;
    if (!task || !task.assigned_to) {
      return new Response(
        JSON.stringify({ success: false, error: "Task or assignee not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", task.assigned_to)
      .maybeSingle();

    const assignedToEmail = profile?.email;
    if (!assignedToEmail) {
      return new Response(
        JSON.stringify({ success: false, error: "Assignee has no email" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const priorityLabels: Record<string, string> = {
      low: "Baixa",
      normal: "Normal",
      high: "Alta",
      urgent: "Urgente",
    };

    const priorityLabel = priorityLabels[task.priority as string] ||
      task.priority || "Normal";
    const assignedToName = profile?.full_name || task.assigned_to_name ||
      "Colaborador";

    let eventInfo = "";
    if (task.event_start_datetime && task.event_end_datetime) {
      const startDate = new Date(task.event_start_datetime as string);
      const endDate = new Date(task.event_end_datetime as string);
      const formatDate = (d: Date) =>
        d.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }) +
        " às " +
        d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      eventInfo = `
        <tr>
          <td style="padding:8px 12px;font-weight:600;color:#374151;">Evento</td>
          <td style="padding:8px 12px;color:#4b5563;">${escapeHtml(formatDate(startDate))} → ${escapeHtml(formatDate(endDate))}</td>
        </tr>`;
    }

    const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:linear-gradient(135deg,#0d9488,#06b6d4);padding:24px 32px;">
        <h1 style="color:#ffffff;margin:0;font-size:20px;">Nova Demanda Atribuída</h1>
      </div>
      <div style="padding:24px 32px;">
        <p style="color:#374151;font-size:16px;margin-bottom:16px;">
          Olá <strong>${escapeHtml(assignedToName)}</strong>,
        </p>
        <p style="color:#4b5563;font-size:14px;margin-bottom:20px;">
          Uma nova demanda foi atribuída a você por <strong>${escapeHtml(task.created_by_name || "Sistema")}</strong>.
        </p>
        <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;margin-bottom:20px;">
          <tr style="border-bottom:1px solid #e5e7eb;">
            <td style="padding:8px 12px;font-weight:600;color:#374151;width:120px;">Título</td>
            <td style="padding:8px 12px;color:#4b5563;">${escapeHtml(task.title)}</td>
          </tr>
          ${task.description ? `<tr style="border-bottom:1px solid #e5e7eb;">
            <td style="padding:8px 12px;font-weight:600;color:#374151;">Descrição</td>
            <td style="padding:8px 12px;color:#4b5563;">${escapeHtml(task.description)}</td>
          </tr>` : ""}
          ${task.category ? `<tr style="border-bottom:1px solid #e5e7eb;">
            <td style="padding:8px 12px;font-weight:600;color:#374151;">Categoria</td>
            <td style="padding:8px 12px;color:#4b5563;">${escapeHtml(task.category)}</td>
          </tr>` : ""}
          <tr style="border-bottom:1px solid #e5e7eb;">
            <td style="padding:8px 12px;font-weight:600;color:#374151;">Prioridade</td>
            <td style="padding:8px 12px;color:#4b5563;">${escapeHtml(priorityLabel)}</td>
          </tr>
          ${task.due_date ? `<tr style="border-bottom:1px solid #e5e7eb;">
            <td style="padding:8px 12px;font-weight:600;color:#374151;">Prazo</td>
            <td style="padding:8px 12px;color:#4b5563;">${escapeHtml(new Date(task.due_date as string).toLocaleDateString("pt-BR"))}</td>
          </tr>` : ""}
          ${eventInfo}
        </table>
        <p style="color:#6b7280;font-size:12px;text-align:center;margin-top:24px;">
          VEG System — Sistema Integrado de Gestão
        </p>
      </div>
    </div>`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "VEG System <onboarding@resend.dev>",
        to: [assignedToEmail],
        subject: `Nova Demanda: ${task.title}`,
        html: htmlBody,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend error:", resendData);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to send email" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error sending task notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
