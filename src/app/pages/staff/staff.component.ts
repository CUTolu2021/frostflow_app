import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-staff',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './staff.component.html',
  styleUrl: './staff.component.css'
})
export class StaffComponent implements OnInit {
  staffList: any[] = [];
  isModalOpen = false;

  newStaff = {
    name: '',
    role: 'sales', // default
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
      password: '', // Should generate a random one or let user type? User said 'admin sets simple password'
      generatedEmail: ''
    };
  }

  generateSystemEmail(): string {
    if (!this.newStaff.name) return '...';

    const cleanName = this.newStaff.name.toLowerCase().trim().replace(/\s+/g, '.');
    // Using a generic prefix or derived from user logic if available. 
    // For now, hardcoding 'store' effectively or we could grab the owner's email domain if we wanted.
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

      // Optional: Show a "Copy Credentials" prompt? User request #2.
      // For now, success toast includes email.
    } catch (error: any) {
      console.error(error);
      this.toast.show(error.message || 'Failed to create staff', 'error');
    }
  }

  async toggleStatus(user: any) {
    const newStatus = !user.is_active;
    try {
      await this.supabase.updateStaffStatus(user.id, newStatus);
      user.is_active = newStatus; // Optimistic update
      this.toast.show(`User ${newStatus ? 'Activated' : 'Disabled'}`, 'info');
    } catch (error) {
      this.toast.show('Failed to update status', 'error');
      user.is_active = !newStatus; // Revert
    }
  }
}
