import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FileDown, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface PdfColumn {
  header: string;
  accessor: string | ((row: any) => string);
}

export interface PdfFilter {
  label: string;
  key: string;
  options: { label: string; value: string }[];
}

interface PdfExportButtonProps {
  title: string;
  filename: string;
  columns: PdfColumn[];
  data: any[];
  filters?: PdfFilter[];
}

export function PdfExportButton({ 
  title, 
  filename, 
  columns, 
  data, 
  filters = [] 
}: PdfExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const handleFilterChange = (key: string, value: string) => {
    setFilterValues(prev => ({ ...prev, [key]: value }));
  };

  const getFilteredData = () => {
    let filtered = [...data];

    // Apply custom filters
    Object.entries(filterValues).forEach(([key, value]) => {
      if (value && value !== 'all') {
        filtered = filtered.filter(item => {
          const itemValue = item[key];
          return itemValue === value;
        });
      }
    });

    return filtered;
  };

  const generatePdf = async () => {
    setIsGenerating(true);
    
    try {
      const filteredData = getFilteredData();
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(title, 14, 20);
      
      // Subtitle with date
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      const dateStr = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
      doc.text(`Gerado em: ${dateStr}`, 14, 28);
      
      // Applied filters info
      let yPos = 32;
      const appliedFilters = Object.entries(filterValues)
        .filter(([, value]) => value && value !== 'all')
        .map(([key, value]) => {
          const filter = filters.find(f => f.key === key);
          const option = filter?.options.find(o => o.value === value);
          return `${filter?.label}: ${option?.label || value}`;
        });
      
      if (appliedFilters.length > 0) {
        doc.text(`Filtros: ${appliedFilters.join(' | ')}`, 14, yPos);
        yPos += 6;
      }
      
      doc.text(`Total de registros: ${filteredData.length}`, 14, yPos);
      
      // Table
      const tableData = filteredData.map(row => 
        columns.map(col => {
          if (typeof col.accessor === 'function') {
            return col.accessor(row);
          }
          return row[col.accessor] ?? '-';
        })
      );
      
      const tableHeaders = columns.map(col => col.header);
      
      autoTable(doc, {
        head: [tableHeaders],
        body: tableData,
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
      
      // Footer
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
      
      // Download
      doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.pdf`);
      setIsOpen(false);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const resetFilters = () => {
    setFilterValues({});
    setDateFrom('');
    setDateTo('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileDown className="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar Relatório PDF</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Configure os filtros abaixo para personalizar o relatório.
          </p>
          
          {filters.map((filter) => (
            <div key={filter.key} className="space-y-2">
              <Label>{filter.label}</Label>
              <Select
                value={filterValues[filter.key] || 'all'}
                onValueChange={(value) => handleFilterChange(filter.key, value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {filter.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              {getFilteredData().length} registros serão exportados
            </p>
          </div>
        </div>
        
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={resetFilters}>
            Limpar Filtros
          </Button>
          <Button onClick={generatePdf} disabled={isGenerating || getFilteredData().length === 0}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <FileDown className="mr-2 h-4 w-4" />
                Gerar PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
