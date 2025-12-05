export type ItemStatus = 'available' | 'pending' | 'delivered';

export type UserRole = 'admin' | 'collaborator' | 'viewer';

export interface LostItem {
  id: string;
  code: string; // 6 digit unique code
  description: string;
  imageUrl: string;
  // Location info
  campus: string;
  foundLocation: string;
  foundDate: string;
  receivedDate: string; // Date item was received at lost & found
  // Storage info
  shelf: string; // Prateleira
  box: string; // Caixa
  sealNumber: string; // Nº do lacre
  // Who delivered the item
  deliveredByName: string;
  deliveredByContact: string;
  // Registration info
  registeredAt: string;
  registeredBy: string; // Responsável pelo recebimento
  status: ItemStatus;
  // Exit info (when delivered)
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  deliveredAt?: string;
  deliveredByTeamMember?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

export interface LogEntry {
  id: string;
  action: string;
  itemId?: string;
  itemCode?: string;
  userId: string;
  userName: string;
  timestamp: string;
  details?: string;
}

export interface DashboardStats {
  totalItems: number;
  availableItems: number;
  deliveredItems: number;
  pendingItems: number;
  thisMonthEntries: number;
  thisMonthExits: number;
}
