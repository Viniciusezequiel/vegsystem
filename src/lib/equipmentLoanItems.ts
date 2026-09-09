import type { Equipment } from '@/hooks/useEquipment';

export type InventorySelectedItem = { kind: 'inventory'; equipment: Equipment; quantity: number };
export type ManualSelectedItem = { kind: 'manual'; key: number; name: string; quantity: number };
export type SelectedLoanItem = InventorySelectedItem | ManualSelectedItem;
export type LoanItemPayload = { equipment_id: string | null; manual_item_name?: string | null; quantity_borrowed: number; skip_stock_deduction?: boolean };

export function normalizeLoanItem(item: LoanItemPayload) {
  if (!Number.isInteger(item.quantity_borrowed) || item.quantity_borrowed < 1) throw new Error('Quantidade inválida');
  const name = item.manual_item_name?.trim() || null;
  if (!item.equipment_id && !name) throw new Error('Nome do item avulso é obrigatório');
  return { ...item, equipment_id: item.equipment_id || null, manual_item_name: item.equipment_id ? null : name };
}

export function selectedLoanPayload(item: SelectedLoanItem, reservedIds: Set<string> = new Set()) {
  return normalizeLoanItem(item.kind === 'inventory'
    ? { equipment_id: item.equipment.id, manual_item_name: null, quantity_borrowed: item.quantity, skip_stock_deduction: reservedIds.has(item.equipment.id) }
    : { equipment_id: null, manual_item_name: item.name, quantity_borrowed: item.quantity });
}

export function loanStockNeeded(items: LoanItemPayload[]) {
  const stock = new Map<string, number>();
  for (const item of items) {
    if (item.equipment_id && !item.skip_stock_deduction) stock.set(item.equipment_id, (stock.get(item.equipment_id) || 0) + item.quantity_borrowed);
  }
  return stock;
}

export function shouldRestoreLoanStock(loan: { equipment_id: string | null; status: string }) {
  return loan.status === 'active' && !!loan.equipment_id;
}

export function loanItemName(loan: { manual_item_name?: string | null; equipment?: { name?: string } | null }) {
  return loan.manual_item_name || loan.equipment?.name || 'Item';
}
