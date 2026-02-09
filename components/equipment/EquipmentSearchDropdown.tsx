import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Search, Check } from 'lucide-react';
import { Equipment } from '@/hooks/useEquipment';

interface SelectedEquipment {
  equipment_id: string;
  equipment_name: string;
  quantity: number;
  max_available: number;
}

interface EquipmentSearchDropdownProps {
  availableEquipment: Equipment[];
  selectedEquipments: SelectedEquipment[];
  onToggleEquipment: (equipment: Equipment) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function EquipmentSearchDropdown({
  availableEquipment,
  selectedEquipments,
  onToggleEquipment,
  disabled = false,
  placeholder = 'Buscar e selecionar equipamentos...',
}: EquipmentSearchDropdownProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);

  const filteredEquipment = useMemo(() => {
    if (!searchQuery.trim()) return availableEquipment;
    
    const query = searchQuery.toLowerCase();
    return availableEquipment.filter(eq => 
      eq.name.toLowerCase().includes(query) ||
      eq.patrimony_code?.toLowerCase().includes(query) ||
      eq.category?.toLowerCase().includes(query) ||
      eq.location?.toLowerCase().includes(query)
    );
  }, [availableEquipment, searchQuery]);

  // Group equipment by category
  const groupedEquipment = useMemo(() => {
    const groups: Record<string, Equipment[]> = {};
    
    filteredEquipment.forEach(eq => {
      const category = eq.category || 'Outros';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(eq);
    });
    
    // Sort categories alphabetically, but put "Outros" at the end
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === 'Outros') return 1;
      if (b === 'Outros') return -1;
      return a.localeCompare(b);
    });
  }, [filteredEquipment]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between h-auto min-h-10 py-2"
          disabled={disabled}
        >
          <span className="text-left truncate">{placeholder}</span>
          <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover border z-50" 
        align="start"
        sideOffset={4}
      >
        {/* Search Input */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, código ou categoria..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
              autoFocus
            />
          </div>
        </div>

        {/* Equipment List */}
        <div className="max-h-72 overflow-y-auto">
          {groupedEquipment.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {searchQuery ? 'Nenhum equipamento encontrado' : 'Nenhum equipamento disponível'}
            </div>
          ) : (
            groupedEquipment.map(([category, items]) => (
              <div key={category}>
                {/* Category Header */}
                <div className="px-3 py-2 bg-muted/50 border-b sticky top-0">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {category} ({items.length})
                  </span>
                </div>
                
                {/* Items in Category */}
                <div className="p-1">
                  {items.map(eq => {
                    const isSelected = selectedEquipments.some(s => s.equipment_id === eq.id);
                    
                    return (
                      <div
                        key={eq.id}
                        className={`flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-primary/10 border border-primary/30' 
                            : 'hover:bg-muted border border-transparent'
                        }`}
                        onClick={() => onToggleEquipment(eq)}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 ${
                          isSelected 
                            ? 'bg-primary border-primary' 
                            : 'border-muted-foreground/30'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{eq.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{eq.patrimony_code}</span>
                            <span>•</span>
                            <span className="text-green-600 dark:text-green-400">
                              {eq.available_quantity} disponível
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer with count */}
        {selectedEquipments.length > 0 && (
          <div className="p-3 border-t bg-muted/30">
            <p className="text-xs text-center text-muted-foreground">
              {selectedEquipments.length} equipamento(s) selecionado(s)
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
