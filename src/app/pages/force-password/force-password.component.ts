import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { getErrorMessage } from '../../utils/error-message';

@Component({
  selector: 'app-force-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './force-password.component.html',
  styleUrl: './force-password.component.css',
})
export class ForcePasswordComponent {
  currentPassword = '';
  nextPassword = '';
  confirmPassword = '';
  isSubmitting = false;
  showCurrent = false;
  showNext = false;
  showConfirm = false;

  constructor(private supabase: SupabaseService, private router: Router, private toast: ToastService) {}

  async submit() {
    if (!this.currentPassword || !this.nextPassword || !this.confirmPassword) {
      this.toast.show('All fields are required', 'error');
      return;
    }
    if (this.nextPassword !== this.confirmPassword) {
      this.toast.show('Passwords do not match', 'error');
      return;
    }
    if (this.nextPassword.length < 8) {
      this.toast.show('Password must be at least 8 characters', 'error');
      return;
    }

    this.isSubmitting = true;
    try {
      await this.supabase.changeOwnPassword(this.currentPassword, this.nextPassword);
      this.toast.show('Password updated. Please log in again.', 'success');
      await this.supabase.signOut();
      this.router.navigate(['/login']);
    } catch (error: unknown) {
      this.toast.show(getErrorMessage(error, 'Failed to update password'), 'error');
    } finally {
      this.isSubmitting = false;
    }
  }

  toggleCurrentVisibility() {
    this.showCurrent = !this.showCurrent;
  }

  toggleNextVisibility() {
    this.showNext = !this.showNext;
  }

  toggleConfirmVisibility() {
    this.showConfirm = !this.showConfirm;
  }
}
