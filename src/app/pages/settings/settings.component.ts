import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent {
  readonly userName = localStorage.getItem('user_name') || 'User';
  readonly userEmail = localStorage.getItem('user_email') || 'No email';
  readonly userRole = localStorage.getItem('user_role') || 'unknown';

  isSigningOut = false;

  constructor(
    private supabase: SupabaseService,
    private router: Router,
    private toast: ToastService
  ) {}

  async signOut() {
    this.isSigningOut = true;
    try {
      await this.supabase.signOut();
      this.toast.show('Logged out', 'info');
      this.router.navigate(['/login']);
    } finally {
      this.isSigningOut = false;
    }
  }
}
