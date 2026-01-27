import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';
import { User } from '@supabase/supabase-js';
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

  newStaff = {
    name: '',
    role: 'sales',
    password: '',
    generatedEmail: ''
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
      name: '',
      role: 'sales',
      password: '',
      generatedEmail: ''
    };
  }

  generateSystemEmail(): string {
    if (!this.newStaff.name) return '...';

    const cleanName = this.newStaff.name.toLowerCase().trim().replace(/\s+/g, '.');


    const orgPrefix = 'store';
    return `${cleanName}@${orgPrefix}.frostflow.app`;
  }

  updateGeneratedEmail() {
    this.newStaff.generatedEmail = this.generateSystemEmail();
  }

  async createStaff() {
    if (!this.newStaff.name || !this.newStaff.password) {
      this.toast.show('Please fill in all fields', 'error');
      return;
    }

    const email = this.generateSystemEmail();

    try {
      await this.supabase.createStaffUser({
        email: email,
        password: this.newStaff.password,
        name: this.newStaff.name,
        role: this.newStaff.role
      });

      this.toast.show(`Staff Created! Login: ${email}`, 'success');
      this.closeModal();
      await this.loadStaff();



    } catch (error: any) {
      console.error(error);
      this.toast.show(error.message || 'Failed to create staff', 'error');
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
}
