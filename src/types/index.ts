export type ItemStatus = 'available' | 'pending' | 'delivered' | 'expired';

export type UserRole = 'admin' | 'analista' | 'assistente';

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
  ownerSignature?: string; // Base64 signature image
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
  itemDescription?: string;
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

// Equipment Management Types
export type EquipmentStatus = 'available' | 'borrowed' | 'maintenance' | 'unavailable';

export interface Equipment {
  id: string;
  code: string;
  name: string;
  category: string;
  brand: string;
  model: string;
  serialNumber: string;
  campus: string;
  location: string;
  status: EquipmentStatus;
  condition: 'new' | 'good' | 'fair' | 'poor';
  imageUrl?: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
  notes?: string;
}

export interface EquipmentLoan {
  id: string;
  equipmentId: string;
  equipmentName: string;
  borrowerName: string;
  borrowerEmail: string;
  borrowerPhone: string;
  borrowerDepartment: string;
  loanDate: string;
  expectedReturn: string;
  actualReturn?: string;
  status: 'active' | 'returned' | 'overdue';
  loanedBy: string;
  returnedBy?: string;
  notes?: string;
}

// Room Checklist Types
export type ChecklistStatus = 'pending' | 'completed' | 'issues';

export interface Room {
  id: string;
  name: string;
  building: string;
  floor: string;
  campus: string;
  capacity: number;
  type: 'classroom' | 'lab' | 'meeting' | 'auditorium' | 'office';
}

export interface RoomChecklist {
  id: string;
  roomId: string;
  roomName: string;
  date: string;
  shift: 'morning' | 'afternoon' | 'evening';
  status: ChecklistStatus;
  checkedBy: string;
  checkedAt?: string;
  items: {
    itemId: string;
    itemName: string;
    checked: boolean;
    issue?: string;
  }[];
  observations?: string;
}

// Locker Management Types
export type LockerStatus = 'available' | 'occupied' | 'maintenance' | 'reserved';

export interface Locker {
  id: string;
  code: string;
  block: string;
  floor: string;
  campus: string;
  size: 'small' | 'medium' | 'large';
  status: LockerStatus;
  currentOccupant?: {
    name: string;
    email: string;
    phone: string;
    department: string;
    startDate: string;
    endDate: string;
  };
}

export interface LockerAllocation {
  id: string;
  lockerId: string;
  lockerCode: string;
  occupantName: string;
  occupantEmail: string;
  occupantPhone: string;
  occupantDepartment: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'expired' | 'terminated';
  allocatedBy: string;
  terminatedBy?: string;
  terminationReason?: string;
}

// Module Stats
export interface ModuleStats {
  lostFound: {
    total: number;
    available: number;
    delivered: number;
    pending: number;
  };
  equipment: {
    total: number;
    available: number;
    borrowed: number;
    maintenance: number;
  };
  rooms: {
    total: number;
    checklistsToday: number;
    pendingChecklists: number;
    issuesReported: number;
  };
  lockers: {
    total: number;
    available: number;
    occupied: number;
    expiringSoon: number;
  };
}
