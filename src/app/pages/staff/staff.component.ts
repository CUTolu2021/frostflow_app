import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';
import { UserProfile } from '../../interfaces/profile';
import { UserRole } from '../../enums/role';
import { getErrorMessage } from '../../utils/error-message';
import { DialogService } from '../../services/dialog.service';

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
  isCreatingInvite = false;
  activeUserActionId: string | null = null;

  newStaff = {
    email: '',
    role: 'sales',
  };

  constructor(
    private supabase: SupabaseService,
    private toast: ToastService,
    private dialog: DialogService
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
    if (this.isCreatingInvite) return;

    if (!this.newStaff.email || !this.newStaff.role) {
      this.toast.show('Please fill in all fields', 'error');
      return;
    }

    this.isCreatingInvite = true;
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

    } catch (error: unknown) {
      console.error(error);
      this.toast.show(getErrorMessage(error, 'Failed to create staff invite'), 'error');
    } finally {
      this.isCreatingInvite = false;
    }
  }

  async toggleStatus(user: UserProfile) {
    if (this.activeUserActionId) return;

    const newStatus = !user.is_active;
    this.activeUserActionId = user.id;
    try {
      await this.supabase.updateStaffStatus(user.id, newStatus);
      user.is_active = newStatus;
      this.toast.show(`User ${newStatus ? 'Activated' : 'Disabled'}`, 'info');
    } catch (error: unknown) {
      this.toast.show(getErrorMessage(error, 'Failed to update staff status'), 'error');
      user.is_active = !newStatus;
    } finally {
      this.activeUserActionId = null;
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
    if (this.activeUserActionId) return;

    const tempPassword = this.generateTempPassword();
    const confirmed = await this.dialog.confirm({
      title: 'Reset Staff Password',
      message: `Reset password for ${user.name}? A temporary password will be generated.`,
      confirmText: 'Reset Password',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!confirmed) return;

    this.activeUserActionId = user.id;
    try {
      await this.supabase.resetStaffPassword(user.id, tempPassword);
      this.toast.show(`Temporary password: ${tempPassword}`, 'success');
    } catch (error: unknown) {
      this.toast.show(getErrorMessage(error, 'Failed to reset password'), 'error');
    } finally {
      this.activeUserActionId = null;
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
