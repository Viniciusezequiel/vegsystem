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
import { FileDown, Loader2 } from 'lucide-react';
import { generatePdf, PdfColumn } from '@/lib/pdfService';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

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

  const handleGeneratePdf = async () => {
    setIsGenerating(true);
    
    try {
      const filteredData = getFilteredData();
      
      // Build applied filters list for PDF
      const appliedFilters = Object.entries(filterValues)
        .filter(([, value]) => value && value !== 'all')
        .map(([key, value]) => {
          const filter = filters.find(f => f.key === key);
          const option = filter?.options.find(o => o.value === value);
          return `${filter?.label}: ${option?.label || value}`;
        });

      await generatePdf({
        title,
        columns,
        data: filteredData,
        filters: appliedFilters.length > 0 ? appliedFilters : undefined,
        filename,
      });

      toast({
        title: 'PDF gerado',
        description: 'O relatório foi exportado com sucesso.',
      });
      
      setIsOpen(false);
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: 'Erro ao gerar PDF',
        description: error.message || 'Falha ao exportar o relatório.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const resetFilters = () => {
    setFilterValues({});
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
          <Button onClick={handleGeneratePdf} disabled={isGenerating || getFilteredData().length === 0}>
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

// Re-export PdfColumn for backward compatibility
export type { PdfColumn };
