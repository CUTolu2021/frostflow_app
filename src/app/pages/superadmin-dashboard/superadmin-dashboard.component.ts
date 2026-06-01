import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';
import { OrganizationSummary } from '../../interfaces/api';
import { getErrorMessage } from '../../utils/error-message';
import { DialogService } from '../../services/dialog.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-superadmin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './superadmin-dashboard.component.html',
  styleUrl: './superadmin-dashboard.component.css',
})
export class SuperadminDashboardComponent implements OnInit {
  organizations: OrganizationSummary[] = [];
  orgModeDraft: Record<string, 'dual_control' | 'single_operator'> = {};
  isLoading = false;
  isSubmitting = false;
  lastTempPassword = '';
  lastOwnerEmail = '';
  pendingTempPassword = '';
  activeOrgActionId: string | null = null;

  form = {
    organizationName: '',
    ownerName: '',
    ownerEmail: '',
  };

  constructor(
    private supabase: SupabaseService,
    private toast: ToastService,
    private dialog: DialogService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadOrganizations();
    this.ensurePendingPassword();
  }

  private ensurePendingPassword() {
    if (!this.pendingTempPassword) {
      this.pendingTempPassword = 'Auto-generated on submit';
    }
  }

  async loadOrganizations() {
    this.isLoading = true;
    try {
      this.organizations = await this.supabase.listOrganizations();
      this.syncOrgModeDrafts();
    } catch (error: unknown) {
      this.toast.show(getErrorMessage(error, 'Failed to load organizations'), 'error');
    } finally {
      this.isLoading = false;
    }
  }

  private syncOrgModeDrafts() {
    const nextDrafts: Record<string, 'dual_control' | 'single_operator'> = {};
    for (const org of this.organizations) {
      const mode = org.inventory_mode === 'single_operator' ? 'single_operator' : 'dual_control';
      nextDrafts[org.id] = mode;
      org.inventory_mode = mode;
    }
    this.orgModeDraft = nextDrafts;
  }

  async createOrganization() {
    const { organizationName, ownerName, ownerEmail } = this.form;
    if (!organizationName || !ownerName || !ownerEmail) {
      this.toast.show('All fields are required', 'error');
      return;
    }

    this.isSubmitting = true;
    try {
      this.pendingTempPassword = '';
      const result = await this.supabase.createOrganizationWithOwner({
        organizationName: organizationName.trim(),
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim(),
      });

      if (result?.organization) {
        this.organizations = [result.organization, ...this.organizations];
        this.syncOrgModeDrafts();
      }
      this.lastTempPassword = result?.tempPassword || '';
      this.lastOwnerEmail = ownerEmail.trim();
      this.pendingTempPassword = this.lastTempPassword;

      this.form = {
        organizationName: '',
        ownerName: '',
        ownerEmail: '',
      };
      this.toast.show('Organization created', 'success');
    } catch (error: unknown) {
      this.toast.show(getErrorMessage(error, 'Failed to create organization'), 'error');
    } finally {
      this.isSubmitting = false;
    }
  }

  async toggleOrganization(org: OrganizationSummary) {
    if (this.activeOrgActionId) return;

    this.activeOrgActionId = org.id;
    try {
      if (org.deleted_at) {
        this.toast.show('Soft-deleted organizations cannot be toggled. Use hard delete.', 'info');
        return;
      }
      const updated = await this.supabase.setOrganizationActive(org.id, !org.is_active);
      org.is_active = updated.is_active;
      this.toast.show(`Organization ${org.is_active ? 'enabled' : 'disabled'}`, 'info');
    } catch (error: unknown) {
      this.toast.show(getErrorMessage(error, 'Failed to update organization'), 'error');
    } finally {
      this.activeOrgActionId = null;
    }
  }

  async softDeleteOrganization(org: OrganizationSummary) {
    if (this.activeOrgActionId) return;

    const confirmed = await this.dialog.confirm({
      title: 'Soft Delete Organization',
      message: `Soft delete "${org.name}"? It will be disabled but data preserved.`,
      confirmText: 'Soft Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!confirmed) return;

    this.activeOrgActionId = org.id;
    try {
      const updated = await this.supabase.softDeleteOrganization(org.id);
      org.is_active = updated.is_active;
      org.deleted_at = updated.deleted_at;
      this.toast.show('Organization soft deleted', 'info');
    } catch (error: unknown) {
      this.toast.show(getErrorMessage(error, 'Failed to soft delete organization'), 'error');
    } finally {
      this.activeOrgActionId = null;
    }
  }

  async deleteOrganization(org: OrganizationSummary) {
    if (this.activeOrgActionId) return;

    const confirmed = await this.dialog.confirm({
      title: 'Delete Organization',
      message: `Delete "${org.name}" permanently? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!confirmed) return;

    this.activeOrgActionId = org.id;
    try {
      await this.supabase.deleteOrganization(org.id);
      this.organizations = this.organizations.filter((o) => o.id !== org.id);
      this.toast.show('Organization deleted', 'success');
    } catch (error: unknown) {
      this.toast.show(getErrorMessage(error, 'Failed to delete organization'), 'error');
    } finally {
      this.activeOrgActionId = null;
    }
  }

  getOrgMode(org: OrganizationSummary): 'dual_control' | 'single_operator' {
    return this.orgModeDraft[org.id] || (org.inventory_mode === 'single_operator' ? 'single_operator' : 'dual_control');
  }

  async saveOrganizationMode(org: OrganizationSummary) {
    if (this.activeOrgActionId) return;

    const nextMode = this.getOrgMode(org);
    if ((org.inventory_mode || 'dual_control') === nextMode) {
      this.toast.show('No mode change to save', 'info');
      return;
    }

    this.activeOrgActionId = org.id;
    try {
      const updated = await this.supabase.updateOrganizationInventoryMode(org.id, nextMode);
      org.inventory_mode = updated.inventory_mode || nextMode;
      this.orgModeDraft[org.id] = org.inventory_mode as 'dual_control' | 'single_operator';
      this.toast.show(
        org.inventory_mode === 'single_operator'
          ? 'Single-operator mode enabled'
          : 'Dual-control mode enabled',
        'success'
      );
    } catch (error: unknown) {
      this.orgModeDraft[org.id] = (org.inventory_mode === 'single_operator' ? 'single_operator' : 'dual_control');
      this.toast.show(getErrorMessage(error, 'Failed to update inventory mode'), 'error');
    } finally {
      this.activeOrgActionId = null;
    }
  }

  handleLogout() {
    localStorage.clear();
    this.supabase.signOut();
    this.toast.show('Logout successful!', 'logout');
    this.router.navigate(['/login']);
  }
}
