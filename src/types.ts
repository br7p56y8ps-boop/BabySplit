export const PUBLIC_SPACE_ID = 'public';

export interface Space {
  id: string;
  name: string;
  type: 'public' | 'private';
  joinPin?: string;
  creatorUid: string;
  creatorMemberId?: string;
  creatorMemberName?: string;
  createdAt: number;
}

export interface SpaceMember {
  id: string; // spaceId_uid
  spaceId: string;
  uid: string;
  joinedAt: number;
}

export interface Member {
  id: string;
  spaceId: string;
  name: string;
  pin: string;
  isTemporary: boolean;
  isPreset?: boolean;
  createdAt: number;
}

export interface ExpenseSettlement {
  id: string;
  debtorId: string;
  creditorId: string;
  amount: number;
  currency: string;
  settledAt: number;
  settledById: string;
  batchId?: string;
}

export interface Expense {
  id: string;
  spaceId: string;
  title: string;
  date: number;
  currency: 'Taka' | 'INR' | 'USD';
  paidBy: Record<string, number>; // memberId -> amount
  participants: string[]; // memberIds
  totalAmount: number;
  status?: 'Unsettled' | 'Partially Settled' | 'Fully Settled';
  settlements?: ExpenseSettlement[];
  settledAt?: number;
  settledById?: string;
  createdAt: number;
  updatedAt: number;
}

export interface History {
  id: string;
  spaceId: string;
  debtorId: string;
  creditorId: string;
  amount: number;
  currency: string;
  expenseId: string; // 'multiple' for batch
  type: 'full' | 'partial';
  settledAt: number;
  settledById: string; // memberId
  undone: boolean;
}

export interface ChatMessage {
  id: string;
  spaceId: string;
  memberId: string;
  memberName: string;
  message: string;
  timestamp: number;
}

export interface Notification {
  id: string;
  spaceId: string;
  type: 'new_expense' | 'expense_edited' | 'expense_deleted' | 'settlement_completed' | 'conflicting_edit';
  message: string;
  timestamp: number;
}

// App-level state context
export interface ActiveIdentity {
  memberId: string;
  spaceId: string;
}
