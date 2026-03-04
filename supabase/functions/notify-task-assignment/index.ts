import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const { taskTitle, taskDescription, taskCategory, taskPriority, assignedToEmail, assignedToName, createdByName, dueDate, eventStart, eventEnd } = await req.json();

    if (!assignedToEmail || !taskTitle) {
      throw new Error("Missing required fields: assignedToEmail, taskTitle");
    }

    const priorityLabels: Record<string, string> = {
      low: "Baixa",
      normal: "Normal",
      high: "Alta",
      urgent: "Urgente",
    };

    const priorityLabel = priorityLabels[taskPriority] || taskPriority || "Normal";

    let eventInfo = "";
    if (eventStart && eventEnd) {
      const startDate = new Date(eventStart);
      const endDate = new Date(eventEnd);
      const formatDate = (d: Date) =>
        d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
        " às " +
        d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      eventInfo = `
        <tr>
          <td style="padding:8px 12px;font-weight:600;color:#374151;">Evento</td>
          <td style="padding:8px 12px;color:#4b5563;">${formatDate(startDate)} → ${formatDate(endDate)}</td>
        </tr>`;
    }

    const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:linear-gradient(135deg,#0d9488,#06b6d4);padding:24px 32px;">
        <h1 style="color:#ffffff;margin:0;font-size:20px;">Nova Demanda Atribuída</h1>
      </div>
      <div style="padding:24px 32px;">
        <p style="color:#374151;font-size:16px;margin-bottom:16px;">
          Olá <strong>${assignedToName || "Colaborador"}</strong>,
        </p>
        <p style="color:#4b5563;font-size:14px;margin-bottom:20px;">
          Uma nova demanda foi atribuída a você por <strong>${createdByName || "Sistema"}</strong>.
        </p>
        <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;margin-bottom:20px;">
          <tr style="border-bottom:1px solid #e5e7eb;">
            <td style="padding:8px 12px;font-weight:600;color:#374151;width:120px;">Título</td>
            <td style="padding:8px 12px;color:#4b5563;">${taskTitle}</td>
          </tr>
          ${taskDescription ? `<tr style="border-bottom:1px solid #e5e7eb;">
            <td style="padding:8px 12px;font-weight:600;color:#374151;">Descrição</td>
            <td style="padding:8px 12px;color:#4b5563;">${taskDescription}</td>
          </tr>` : ""}
          ${taskCategory ? `<tr style="border-bottom:1px solid #e5e7eb;">
            <td style="padding:8px 12px;font-weight:600;color:#374151;">Categoria</td>
            <td style="padding:8px 12px;color:#4b5563;">${taskCategory}</td>
          </tr>` : ""}
          <tr style="border-bottom:1px solid #e5e7eb;">
            <td style="padding:8px 12px;font-weight:600;color:#374151;">Prioridade</td>
            <td style="padding:8px 12px;color:#4b5563;">${priorityLabel}</td>
          </tr>
          ${dueDate ? `<tr style="border-bottom:1px solid #e5e7eb;">
            <td style="padding:8px 12px;font-weight:600;color:#374151;">Prazo</td>
            <td style="padding:8px 12px;color:#4b5563;">${new Date(dueDate).toLocaleDateString("pt-BR")}</td>
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
        subject: `Nova Demanda: ${taskTitle}`,
        html: htmlBody,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend error:", resendData);
      throw new Error(`Resend API error [${resendResponse.status}]: ${JSON.stringify(resendData)}`);
    }

    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error sending task notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
