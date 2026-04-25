export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  organization_id?: string | null;
  organization_name?: string | null;
  is_active: boolean;
  must_reset_password?: boolean;
}
