import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';
import { getErrorMessage } from '../../utils/error-message';

@Component({
  selector: 'app-staff-signup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './staff-signup.component.html',
  styleUrl: './staff-signup.component.css',
})
export class StaffSignupComponent implements OnInit {
  token = '';
  invitedEmail = '';
  role = '';
  expiresAt = '';
  isLoadingInvite = true;
  isSubmitting = false;

  name = '';
  email = '';
  password = '';
  confirmPassword = '';

  showPassword = false;
  showConfirm = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabase: SupabaseService,
    private toast: ToastService,
  ) {}

  async ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) {
      this.toast.show('Missing invite token', 'error');
      this.isLoadingInvite = false;
      return;
    }

    try {
      const invite = await this.supabase.previewStaffInvite(this.token);
      this.invitedEmail = invite.invitedEmail;
      this.email = invite.invitedEmail;
      this.role = invite.role;
      this.expiresAt = invite.expiresAt;
    } catch (error: unknown) {
      this.toast.show(getErrorMessage(error, 'Invalid invite link'), 'error');
    } finally {
      this.isLoadingInvite = false;
    }
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirm() {
    this.showConfirm = !this.showConfirm;
  }

  async submit() {
    if (!this.token || !this.name || !this.email || !this.password || !this.confirmPassword) {
      this.toast.show('All fields are required', 'error');
      return;
    }
    if (this.email.trim().toLowerCase() !== this.invitedEmail.trim().toLowerCase()) {
      this.toast.show('Email must match the invited email', 'error');
      return;
    }
    if (this.password.length < 8) {
      this.toast.show('Password must be at least 8 characters', 'error');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.toast.show('Passwords do not match', 'error');
      return;
    }

    this.isSubmitting = true;
    try {
      await this.supabase.completeStaffInvite({
        token: this.token,
        email: this.email.trim().toLowerCase(),
        name: this.name.trim(),
        password: this.password,
      });
      this.toast.show('Account created. You can now log in.', 'success');
      this.router.navigate(['/login']);
    } catch (error: unknown) {
      this.toast.show(getErrorMessage(error, 'Failed to complete signup'), 'error');
    } finally {
      this.isSubmitting = false;
    }
  }
}
