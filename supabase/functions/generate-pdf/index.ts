import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Dynamic imports for jspdf
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
  // Handle CORS preflight
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

    const body: PdfRequest = await req.json();
    const { title, subtitle, columns, data, filters, orientation = 'portrait' } = body;

    if (!title || !columns || !data) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: title, columns, data' }),
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

    // Subtitle with date
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    
    const now = new Date();
    const dateStr = now.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    let yPos = 28;
    doc.text(`Gerado em: ${dateStr}`, 14, yPos);
    
    // Subtitle if provided
    if (subtitle) {
      yPos += 6;
      doc.text(subtitle, 14, yPos);
    }

    // Applied filters info
    if (filters && filters.length > 0) {
      yPos += 6;
      doc.text(`Filtros: ${filters.join(' | ')}`, 14, yPos);
    }

    // Total records
    yPos += 6;
    doc.text(`Total de registros: ${data.length}`, 14, yPos);

    // Table headers
    const tableHeaders = columns.map(col => col.header);

    // Generate table
    autoTable(doc, {
      head: [tableHeaders],
      body: data,
      startY: yPos + 8,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
      margin: { left: 14, right: 14 },
    });

    // Footer with pagination
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

    // Output as binary
    const pdfOutput = doc.output('arraybuffer');

    return new Response(pdfOutput, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${body.filename || 'relatorio'}.pdf"`,
      },
    });

  } catch (error: unknown) {
    console.error('Error generating PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate PDF';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
