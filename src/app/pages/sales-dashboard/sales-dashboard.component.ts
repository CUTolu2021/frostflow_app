import { Component } from '@angular/core';
import { FormGroup, FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { WebhookService } from '../../services/webhook.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sales-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './sales-dashboard.component.html',
  styleUrl: './sales-dashboard.component.css'
})
export class SalesDashboardComponent {
products: any[] = [];
  salesForm: FormGroup; 
  dailySalesForm: FormGroup;
  paymentMethods: string[] = ['Cash', 'Card', 'Transfer'];
  public name: string = localStorage.getItem('user_name') || '';
  email: string = localStorage.getItem('user_email') || '';
  

  constructor(
    private supabase: SupabaseService,
    private fb: FormBuilder,
    private n8n: WebhookService,
    private router: Router,
  ) {
    //this.initializeUser();
    this.salesForm = this.fb.group({
      name: ['', Validators.minLength(1)],
      product_id: ['', Validators.required], 
      quantity: [0, [Validators.required, Validators.min(1)]],
      recorded_by: [this.email, Validators.required],
      unit_price: [0, [Validators.required, Validators.min(0)]]
    });

    this.dailySalesForm = this.fb.group({
      product_id: ['', Validators.required], 
      quantity: [0, [Validators.required, Validators.min(1)]],
      unit_price: [0, [Validators.required, Validators.min(0)]],
      total_price: [0, [Validators.required, Validators.min(0)]],
      payment_method: ['', Validators.required],
      recorded_by: [this.email, Validators.required]
    });    
  }

  // private async initializeUser(): Promise<void> {
  //   try {
  //     const user = await this.supabase.getCurrentUser();
  //     if (user) {
  //       this.email = user?.user_metadata['email'] || 'Unknown';
  //       this.name = user?.user_metadata['name'] || 'Unknown';
  //       this.dailySalesForm.get('recorded_by')?.setValue(this.email);
  //     }
  //   } catch (error) {
  //     console.error('Error getting current user:', error);
  //   }
  // }

  ngOnInit(): void {
    this.loadProducts();
    this.setupFormListeners();
    console.log("User name:", this.name);
  }

  setupFormListeners() {
    // 1. Listen to Dropdown Changes
    this.salesForm.get('product_id')?.valueChanges.subscribe((selectedId) => {
      const nameControl = this.salesForm.get('name');
      
      if (selectedId) {
        nameControl?.disable({ emitEvent: false }); 
        nameControl?.setValue(''); // Clear any text they typed
      } else {
        // If user selects "Choose", enable the Name input
        nameControl?.enable({ emitEvent: false });
      }
    });

    // 2. Listen to Name Input Changes
    this.salesForm.get('name')?.valueChanges.subscribe((text) => {
      const dropdownControl = this.salesForm.get('product_id');

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
    if (this.salesForm.valid) {
      console.log('Sending to n8n:', this.salesForm.value);
      this.n8n.sendSalesStock(this.salesForm.value);
    } else {
      alert('Please fill the form correctly');
    }
    alert('Stock Recorded Successfully');
    this.salesForm.reset();
  }

  onSalesRecordSubmit() {
    if (this.dailySalesForm.valid) {
      console.log('Sending Daily Sales Record to n8n:', this.dailySalesForm.value);
      this.n8n.sendDailySales(this.dailySalesForm.value);
    } else {
      alert('Please fill the form correctly');
    }
    alert('Daily Sales Recorded Successfully');
    this.dailySalesForm.reset();
  }

  handleLogout() {
    localStorage.clear();
    this.supabase.signOut();
    this.router.navigate(['/login']);
  }

}
