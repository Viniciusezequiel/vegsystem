import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PdfRequest {
  title: string;
  subtitle?: string;
  columns: Array<{ header: string }>;
  data: string[][];
  filters?: string[];
  orientation?: 'portrait' | 'landscape';
  filename?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: PdfRequest = await req.json();
    const { title, subtitle, columns, data, filters, orientation = 'portrait' } = body;

    if (!title || !columns || !data) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: title, columns, data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Input validation
    if (typeof title !== 'string' || title.length > 200) {
      return new Response(
        JSON.stringify({ error: 'Invalid title' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (subtitle && (typeof subtitle !== 'string' || subtitle.length > 500)) {
      return new Response(
        JSON.stringify({ error: 'Invalid subtitle' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!Array.isArray(columns) || columns.length === 0 || columns.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Invalid columns' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!Array.isArray(data) || data.length > 10000) {
      return new Response(
        JSON.stringify({ error: 'Invalid data or too many rows' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (orientation && !['portrait', 'landscape'].includes(orientation)) {
      return new Response(
        JSON.stringify({ error: 'Invalid orientation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Import jsPDF dynamically
    const { default: jsPDF } = await import('https://esm.sh/jspdf@2.5.1');
    const { default: autoTable } = await import('https://esm.sh/jspdf-autotable@3.8.2');

    // Create PDF
    const doc = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: 'a4',
    });

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    
    const now = new Date();
    const dateStr = now.toLocaleString('pt-BR', { 
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    
    let yPos = 28;
    doc.text(`Gerado em: ${dateStr}`, 14, yPos);
    
    if (subtitle) {
      yPos += 6;
      doc.text(subtitle, 14, yPos);
    }

    if (filters && filters.length > 0) {
      yPos += 6;
      doc.text(`Filtros: ${filters.join(' | ')}`, 14, yPos);
    }

    yPos += 6;
    doc.text(`Total de registros: ${data.length}`, 14, yPos);

    const tableHeaders = columns.map(col => col.header);

    autoTable(doc, {
      head: [tableHeaders],
      body: data,
      startY: yPos + 8,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Página ${i} de ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }

    const pdfOutput = doc.output('arraybuffer');

    return new Response(pdfOutput, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${(body.filename || 'relatorio').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf"`,
      },
    });

  } catch (error: unknown) {
    console.error('Error generating PDF:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate PDF' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
