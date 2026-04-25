import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';

interface OrganizationSummary {
  id: string;
  name: string;
  is_active: boolean;
  deleted_at?: string | null;
  created_at: string;
}

@Component({
  selector: 'app-superadmin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './superadmin-dashboard.component.html',
  styleUrl: './superadmin-dashboard.component.css',
})
export class SuperadminDashboardComponent implements OnInit {
  organizations: OrganizationSummary[] = [];
  isLoading = false;
  isSubmitting = false;
  lastTempPassword = '';
  lastOwnerEmail = '';
  pendingTempPassword = '';

  form = {
    organizationName: '',
    ownerName: '',
    ownerEmail: '',
  };

  constructor(private supabase: SupabaseService, private toast: ToastService) {}

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
    } catch (error: any) {
      this.toast.show(error?.message || 'Failed to load organizations', 'error');
    } finally {
      this.isLoading = false;
    }
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
    } catch (error: any) {
      this.toast.show(error?.error?.message || error?.message || 'Failed to create organization', 'error');
    } finally {
      this.isSubmitting = false;
    }
  }

  async toggleOrganization(org: OrganizationSummary) {
    try {
      if (org.deleted_at) {
        this.toast.show('Soft-deleted organizations cannot be toggled. Use hard delete.', 'info');
        return;
      }
      const updated = await this.supabase.setOrganizationActive(org.id, !org.is_active);
      org.is_active = updated.is_active;
      this.toast.show(`Organization ${org.is_active ? 'enabled' : 'disabled'}`, 'info');
    } catch (error: any) {
      this.toast.show(error?.message || 'Failed to update organization', 'error');
    }
  }

  async softDeleteOrganization(org: OrganizationSummary) {
    if (!confirm(`Soft delete organization "${org.name}"? It will be disabled but data preserved.`)) return;
    try {
      const updated = await this.supabase.softDeleteOrganization(org.id);
      org.is_active = updated.is_active;
      org.deleted_at = updated.deleted_at;
      this.toast.show('Organization soft deleted', 'info');
    } catch (error: any) {
      this.toast.show(error?.message || 'Failed to soft delete organization', 'error');
    }
  }

  async deleteOrganization(org: OrganizationSummary) {
    if (!confirm(`Delete organization "${org.name}"? This cannot be undone.`)) return;
    try {
      await this.supabase.deleteOrganization(org.id);
      this.organizations = this.organizations.filter((o) => o.id !== org.id);
      this.toast.show('Organization deleted', 'success');
    } catch (error: any) {
      this.toast.show(error?.message || 'Failed to delete organization', 'error');
    }
  }
}
