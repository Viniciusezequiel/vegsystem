export type ItemStatus = 'available' | 'pending' | 'delivered';

export type UserRole = 'admin' | 'collaborator' | 'viewer';

export interface LostItem {
  id: string;
  code: string;
  description: string;
  imageUrl: string;
  foundLocation: string;
  foundDate: string;
  deliveredByName: string;
  deliveredByContact: string;
  registeredAt: string;
  registeredBy: string;
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
