import { AuthUser } from './auth-user';
import { Notification } from './notification';
import { Product } from './product';
import { Sale } from './sales';
import { StockEntry, StaffStockEntry } from './stock';

export interface OrganizationSummary {
  id: string;
  name: string;
  is_active: boolean;
  deleted_at?: string | null;
  created_at: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  organization_id?: string | null;
  must_reset_password?: boolean;
  created_at?: string;
  organizations?: {
    name: string;
  } | null;
}

export interface CreateOrganizationResponse {
  organization: OrganizationSummary;
  owner: AuthUser;
  tempPassword?: string;
  emailStatus?: {
    sent: boolean;
    skipped: boolean;
    error: string | null;
  };
}

export interface ChartDataPoint {
  name: string;
  current_balance: number;
  total_sold: number;
}

export interface NotificationRecord extends Notification {
  id: string | number;
  type: string;
  role?: string;
  user_id?: string | null;
  organization_id?: string | null;
}

export interface InventoryLog extends StockEntry {
  id: string;
  logged_date?: string;
  products?: Product;
}

export interface PollingPayload<T> {
  new: T;
}

export type AuthSessionLike = { user: AuthUser } | null;

export interface StaffInviteResult {
  inviteId: string;
  inviteLink: string;
  invitedEmail: string;
  role: string;
  expiresAt: string;
  emailStatus?: {
    sent: boolean;
    skipped: boolean;
    error: string | null;
  };
}

export type RecentSale = Sale;
export type RecentStaffEntry = StaffStockEntry;
