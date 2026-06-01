import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';
import { getErrorMessage } from '../../utils/error-message';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit {
  readonly userName = localStorage.getItem('user_name') || 'User';
  readonly userEmail = localStorage.getItem('user_email') || 'No email';
  readonly userRole = localStorage.getItem('user_role') || 'unknown';

  isSigningOut = false;
  isLoadingMode = false;
  isSavingMode = false;
  organizationMode: 'dual_control' | 'single_operator' = 'dual_control';
  readonly canManageInventoryMode = this.userRole === 'admin';

  constructor(
    private supabase: SupabaseService,
    private router: Router,
    private toast: ToastService
  ) {}

  async ngOnInit() {
    if (!this.canManageInventoryMode) return;
    await this.loadOrganizationSettings();
  }

  private async loadOrganizationSettings() {
    this.isLoadingMode = true;
    try {
      const settings = await this.supabase.getOrganizationSettings();
      this.organizationMode = settings.inventory_mode === 'single_operator'
        ? 'single_operator'
        : 'dual_control';
      localStorage.setItem('organization_inventory_mode', this.organizationMode);
    } catch (error: unknown) {
      this.toast.show(getErrorMessage(error, 'Failed to load organization settings'), 'error');
    } finally {
      this.isLoadingMode = false;
    }
  }

  async saveInventoryMode() {
    if (!this.canManageInventoryMode || this.isSavingMode) return;
    this.isSavingMode = true;
    try {
      const settings = await this.supabase.updateOrganizationSettings({
        inventory_mode: this.organizationMode,
      });
      this.organizationMode = settings.inventory_mode;
      localStorage.setItem('organization_inventory_mode', this.organizationMode);
      window.dispatchEvent(
        new CustomEvent('organization-mode-changed', {
          detail: { inventoryMode: this.organizationMode },
        })
      );
      this.toast.show(
        this.organizationMode === 'single_operator'
          ? 'Single-operator mode enabled'
          : 'Dual-control mode enabled',
        'success'
      );
    } catch (error: unknown) {
      this.toast.show(getErrorMessage(error, 'Failed to save inventory mode'), 'error');
    } finally {
      this.isSavingMode = false;
    }
  }

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
