import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-superadmin-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './superadmin-users.component.html',
  styleUrl: './superadmin-users.component.css',
})
export class SuperadminUsersComponent implements OnInit {
  users: any[] = [];
  isLoading = false;
  lastReset = { email: '', tempPassword: '' };

  constructor(private supabase: SupabaseService, private toast: ToastService) {}

  async ngOnInit() {
    await this.loadUsers();
  }

  async loadUsers() {
    this.isLoading = true;
    try {
      this.users = await this.supabase.listAllUsers();
    } catch (error: any) {
      this.toast.show(error?.message || 'Failed to load users', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async toggleActive(user: any) {
    try {
      const updated = await this.supabase.setUserActive(user.id, !user.is_active);
      user.is_active = updated.is_active;
      this.toast.show(`User ${updated.is_active ? 'activated' : 'disabled'}`, 'info');
    } catch (error: any) {
      this.toast.show(error?.message || 'Failed to update user', 'error');
    }
  }

  async resetPassword(user: any) {
    try {
      const res = await this.supabase.resetUserPassword(user.id);
      this.lastReset = { email: user.email, tempPassword: res.tempPassword || '' };
      this.toast.show('Temporary password generated and emailed', 'success');
    } catch (error: any) {
      this.toast.show(error?.message || 'Failed to reset password', 'error');
    }
  }
}
