import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent implements OnInit, OnDestroy {
  private mismatchRefreshTimer: ReturnType<typeof setInterval> | null = null;

  userRole: string | null = '';
  organizationName: string | null = '';
  pendingMismatchCount = 0;

  constructor(
    private supabase: SupabaseService,
    private toast: ToastService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.userRole = localStorage.getItem('user_role');
    this.organizationName = localStorage.getItem('organization_name');

    if (this.userRole === 'admin' || this.userRole === 'manager') {
      this.loadPendingMismatchCount();
      this.mismatchRefreshTimer = setInterval(() => {
        this.loadPendingMismatchCount();
      }, 30000);
    }
  }

  ngOnDestroy() {
    if (this.mismatchRefreshTimer) {
      clearInterval(this.mismatchRefreshTimer);
      this.mismatchRefreshTimer = null;
    }
  }

  private async loadPendingMismatchCount() {
    try {
      const mismatches = await this.supabase.getPendingMismatches();
      this.pendingMismatchCount = mismatches.length;
    } catch {
      this.pendingMismatchCount = 0;
    }
  }

  handleLogout() {
    localStorage.clear();
    this.supabase.signOut();
    this.toast.show('Logout successful!', 'logout');
    this.router.navigate(['/login']);
  }
}
