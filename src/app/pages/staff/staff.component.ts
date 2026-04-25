import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';
import { UserProfile } from '../../interfaces/profile';
import { UserRole } from '../../enums/role';

@Component({
  selector: 'app-staff',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './staff.component.html',
  styleUrl: './staff.component.css'
})
export class StaffComponent implements OnInit {
  UserRole = UserRole;
  staffList: UserProfile[] = [];
  isModalOpen = false;
  latestInviteLink = '';
  latestInviteEmail = '';

  newStaff = {
    email: '',
    role: 'sales',
  };

  constructor(
    private supabase: SupabaseService,
    private toast: ToastService
  ) { }

  async ngOnInit() {
    await this.loadStaff();
  }

  async loadStaff() {
    this.staffList = await this.supabase.getStaffList();
  }

  openModal() {
    this.isModalOpen = true;
    this.resetForm();
  }

  closeModal() {
    this.isModalOpen = false;
  }

  resetForm() {
    this.newStaff = {
      email: '',
      role: 'sales',
    };
  }

  async createStaff() {
    if (!this.newStaff.email || !this.newStaff.role) {
      this.toast.show('Please fill in all fields', 'error');
      return;
    }

    try {
      const invite = await this.supabase.createStaffInvite({
        email: this.newStaff.email.trim().toLowerCase(),
        role: this.newStaff.role
      });

      this.latestInviteLink = invite.inviteLink;
      this.latestInviteEmail = invite.invitedEmail;
      if (invite.emailStatus?.sent) {
        this.toast.show(`Invite generated and emailed to ${invite.invitedEmail}`, 'success');
      } else if (invite.emailStatus?.skipped) {
        this.toast.show(`Invite generated. Email not sent because SMTP is not configured.`, 'info');
      } else if (invite.emailStatus?.error) {
        this.toast.show(`Invite generated, but email failed: ${invite.emailStatus.error}`, 'error');
      } else {
        this.toast.show(`Invite generated for ${invite.invitedEmail}`, 'success');
      }
      this.resetForm();

    } catch (error: any) {
      console.error(error);
      this.toast.show(error.message || 'Failed to create staff invite', 'error');
    }
  }

  async toggleStatus(user: UserProfile) {
    const newStatus = !user.is_active;
    try {
      await this.supabase.updateStaffStatus(user.id, newStatus);
      user.is_active = newStatus;
      this.toast.show(`User ${newStatus ? 'Activated' : 'Disabled'}`, 'info');
    } catch (error) {
      this.toast.show('Failed to update status', 'error');
      user.is_active = !newStatus;
    }
  }

  private generateTempPassword(): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%';
    const all = upper + lower + digits + symbols;
    const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
    const base = [pick(upper), pick(lower), pick(digits), pick(symbols)];
    for (let i = 0; i < 8; i++) {
      base.push(pick(all));
    }
    return base.sort(() => Math.random() - 0.5).join('');
  }

  async resetPassword(user: UserProfile) {
    const tempPassword = this.generateTempPassword();
    const confirmed = confirm(`Reset password for ${user.name}? A temporary password will be generated.`);
    if (!confirmed) return;

    try {
      await this.supabase.resetStaffPassword(user.id, tempPassword);
      this.toast.show(`Temporary password: ${tempPassword}`, 'success');
    } catch (error: any) {
      this.toast.show(error?.message || 'Failed to reset password', 'error');
    }
  }

  async copyInviteLink() {
    if (!this.latestInviteLink) return;
    try {
      await navigator.clipboard.writeText(this.latestInviteLink);
      this.toast.show('Invite link copied', 'success');
    } catch {
      this.toast.show('Could not copy link', 'error');
    }
  }
}
