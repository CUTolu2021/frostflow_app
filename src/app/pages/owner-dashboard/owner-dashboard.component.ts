import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'; // <--- Import these
import { SupabaseService } from '../../services/supabase.service';
import { WebhookService } from '../../services/webhook.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-owner-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule], // <--- Add ReactiveFormsModule here
  templateUrl: './owner-dashboard.component.html',
  styleUrls: ['./owner-dashboard.component.css']
})
export class OwnerDashboardComponent implements OnInit {
  products: any[] = [];
  stockForm: FormGroup;
  salesPersonForm: FormGroup;
  passwordVisible: boolean = false;
  public name: string = localStorage.getItem('user_name') || '';
  email: string = localStorage.getItem('user_email') || '';


  constructor(
    private supabase: SupabaseService,
    private fb: FormBuilder, 
    private n8n: WebhookService,
    private router: Router
  ) {
    //this.initializeUser();
    this.stockForm = this.fb.group({
      name: ['', Validators.min(1)],
      product_id: ['', Validators.required], // Dropdown value
      quantity: [[Validators.required, Validators.min(1)]],
      unit_price: [ [Validators.required, Validators.min(0)]],
      total_cost: [ [Validators.required, Validators.min(0)]],
      recorded_by: [this.email, Validators.required]
    });

    this.salesPersonForm = this.fb.group({
      name: ['', Validators.min(1)],
      role:['sales'],
      email: ['', [Validators.required, Validators.email]],
    });
  
  }
  // private async initializeUser(): Promise<void> {
  //   try {
  //     const user = await this.supabase.getCurrentUser();
  //     console.log("Owner Dashboard - Current User:", user);
  //     if (user) {
  //       this.email = user?.user_metadata['email'] || 'Unknown';
  //       this.name = user?.user_metadata['name'] || 'Unknown';
  //       // Update the recorded_by field with the actual email
  //       this.stockForm.get('recorded_by')?.setValue(this.email);
  //     }
  //   } catch (error) {
  //     console.error('Error getting current user:', error);
  //   }
  // }

  ngOnInit(): void {
    this.loadProducts();
    this.setupFormListeners();
  }

  setupFormListeners() {
    // 1. Listen to Dropdown Changes
    this.stockForm.get('product_id')?.valueChanges.subscribe((selectedId) => {
      const nameControl = this.stockForm.get('name');
      
      if (selectedId) {
        // If user selects a product, disable the Name input
        nameControl?.disable({ emitEvent: false }); 
        nameControl?.setValue(''); // Clear any text they typed
      } else {
        // If user selects "Choose", enable the Name input
        nameControl?.enable({ emitEvent: false });
      }
    });

    // 2. Listen to Name Input Changes
    this.stockForm.get('name')?.valueChanges.subscribe((text) => {
      const dropdownControl = this.stockForm.get('product_id');

      if (text && text.length > 0) {
        // If user types text, disable the Dropdown
        dropdownControl?.disable({ emitEvent: false });
        dropdownControl?.setValue(''); // Reset dropdown
      } else {
        dropdownControl?.enable({ emitEvent: false });
      }
    });
  }

  async loadProducts() {
    this.products = await this.supabase.getProducts();
  }

  onSubmit() {
    if (this.stockForm.valid) {
      console.log('Sending to n8n:', this.stockForm.value);
      this.n8n.sendOwnerStock(this.stockForm.value);
    } else {
      alert('Please fill the form correctly');
    }
    alert('Stock Recorded Successfully');
    this.stockForm.reset();
    window.location.reload();

  }

  createSalesPerson() {
    if (this.salesPersonForm.valid) {
      const { name, email, role } = this.salesPersonForm.value;

      // Pass name and role in the options.data object
      this.supabase.signUpWithPassword(email!, "@password", {
        data: {
          name: name,
          role: role
        }
      });
    } else {
      alert('Please fill the form correctly');
    }
    alert('Sales Person Account Created Successfully');
    this.salesPersonForm.reset();
  }


  handleLogout() {
    localStorage.clear();
    this.supabase.signOut();
    this.router.navigate(['/login']);
  }

  togglePasswordVisibility() {
    this.passwordVisible = !this.passwordVisible;
  }

}