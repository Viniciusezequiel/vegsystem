import { MainLayout } from '@/components/layout/MainLayout';
import { useEquipmentLoans } from '../../hooks/useEquipment';
import { Loader2 } from 'lucide-react';

export default function EquipmentLoans() {
  const { data: loans, isLoading, error } = useEquipmentLoans();

  if (isLoading) return <MainLayout><div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div></MainLayout>;
  if (error) return <MainLayout><p className="text-destructive">Erro ao carregar empréstimos</p></MainLayout>;

  return (
    <MainLayout>
      <h1 className="text-2xl font-bold mb-4">Empréstimos de Equipamentos</h1>
      <ul className="space-y-2">
        {(loans ?? []).map((loan) => (
          <li key={loan.id} className="p-3 bg-card border rounded-lg">
            {loan.equipment_id} - {loan.borrower_name} ({loan.status})
          </li>
        ))}
      </ul>
    </MainLayout>
  );
}
