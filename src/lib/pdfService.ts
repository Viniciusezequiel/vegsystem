import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface PdfColumn {
  header: string;
  accessor?: string | ((row: any) => string);
}

export interface GeneratePdfOptions {
  title: string;
  subtitle?: string;
  columns: PdfColumn[];
  data: any[];
  filters?: string[];
  orientation?: 'portrait' | 'landscape';
  filename: string;
}

/**
 * Generates a PDF using the backend Edge Function and triggers download
 */
export async function generatePdf(options: GeneratePdfOptions): Promise<void> {
  const { title, subtitle, columns, data, filters, orientation = 'portrait', filename } = options;

  // Convert data to string[][] using accessors
  const tableData = data.map(row => 
    columns.map(col => {
      if (typeof col.accessor === 'function') {
        return String(col.accessor(row) ?? '-');
      }
      if (typeof col.accessor === 'string') {
        return String(row[col.accessor] ?? '-');
      }
      return '-';
    })
  );

  // Prepare columns for the edge function (only headers)
  const pdfColumns = columns.map(col => ({ header: col.header }));

  // Call Edge Function
  const { data: pdfBlob, error } = await supabase.functions.invoke('generate-pdf', {
    body: {
      title,
      subtitle,
      columns: pdfColumns,
      data: tableData,
      filters,
      orientation,
      filename: `${filename}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}`,
    },
  });

  if (error) {
    throw new Error(error.message || 'Falha ao gerar PDF');
  }

  // Handle the response - it should be a blob
  let blob: Blob;
  
  if (pdfBlob instanceof Blob) {
    blob = pdfBlob;
  } else if (pdfBlob instanceof ArrayBuffer) {
    blob = new Blob([pdfBlob], { type: 'application/pdf' });
  } else {
    throw new Error('Resposta inválida do servidor');
  }

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
