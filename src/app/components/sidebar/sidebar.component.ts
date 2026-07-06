import { Component, EventEmitter, OnDestroy, OnInit, Output, effect } from '@angular/core';
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
  @Output() navigationRequested = new EventEmitter<void>();
  private mismatchRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private modeChangedListener = (event: Event) => {
    const customEvent = event as CustomEvent<{ inventoryMode?: string }>;
    const nextMode = customEvent?.detail?.inventoryMode === 'single_operator'
      ? 'single_operator'
      : 'dual_control';
    this.organizationInventoryMode = nextMode;
    localStorage.setItem('organization_inventory_mode', nextMode);
    this.refreshMismatchPollingForMode();
  };

  userRole: string | null = '';
  organizationName: string | null = '';
  pendingMismatchCount = 0;
  organizationInventoryMode: 'dual_control' | 'single_operator' = 'dual_control';

  constructor(
    private supabase: SupabaseService,
    private toast: ToastService,
    private router: Router,
  ) {
    effect(() => {
      this.pendingMismatchCount = this.supabase.pendingMismatchCount();
    });
  }

  async ngOnInit() {
    this.userRole = localStorage.getItem('user_role');
    this.organizationName = localStorage.getItem('organization_name');
    const cachedMode = localStorage.getItem('organization_inventory_mode');
    this.organizationInventoryMode = cachedMode === 'single_operator' ? 'single_operator' : 'dual_control';

    if (this.userRole === 'admin' || this.userRole === 'manager') {
      await this.loadOrganizationMode();
      this.refreshMismatchPollingForMode();
      window.addEventListener('organization-mode-changed', this.modeChangedListener);
    } else {
      this.pendingMismatchCount = 0;
    }
  }

  ngOnDestroy() {
    this.stopMismatchPolling();
    window.removeEventListener('organization-mode-changed', this.modeChangedListener);
  }

  private async loadPendingMismatchCount() {
    await this.supabase.refreshPendingMismatchCount();
  }

  private startMismatchPolling() {
    this.stopMismatchPolling();
    this.loadPendingMismatchCount();
    this.mismatchRefreshTimer = setInterval(() => {
      this.loadPendingMismatchCount();
    }, 30000);
  }

  private stopMismatchPolling() {
    if (this.mismatchRefreshTimer) {
      clearInterval(this.mismatchRefreshTimer);
      this.mismatchRefreshTimer = null;
    }
  }

  private refreshMismatchPollingForMode() {
    if (this.organizationInventoryMode === 'single_operator') {
      this.stopMismatchPolling();
      this.pendingMismatchCount = 0;
      return;
    }
    this.startMismatchPolling();
  }

  private async loadOrganizationMode() {
    try {
      const settings = await this.supabase.getOrganizationSettings();
      this.organizationInventoryMode = settings.inventory_mode === 'single_operator'
        ? 'single_operator'
        : 'dual_control';
      localStorage.setItem('organization_inventory_mode', this.organizationInventoryMode);
    } catch {
      this.organizationInventoryMode = 'dual_control';
    }
  }

  handleLogout() {
    localStorage.clear();
    this.supabase.signOut();
    this.toast.show('Logout successful!', 'logout');
    this.router.navigate(['/login']);
  }

  handleNavigationRequested() {
    this.navigationRequested.emit();
  }
}

