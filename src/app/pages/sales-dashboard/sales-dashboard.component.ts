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
    
    this.salesForm = this.fb.group({
      name: ['', Validators.minLength(1)],
      product_id: [' ', Validators.required], 
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

  
  
  
  
  
  
  
  
  
  
  
  

  ngOnInit(): void {
    this.loadProducts();
    this.setupFormListeners();
    console.log("User name:", this.name);
  }

  setupFormListeners() {
    
    this.salesForm.get('product_id')?.valueChanges.subscribe((selectedId) => {
      const nameControl = this.salesForm.get('name');
      
      if (selectedId) {
        nameControl?.disable({ emitEvent: false }); 
        nameControl?.setValue(''); 
      } else {
        
        nameControl?.enable({ emitEvent: false });
      }
    });

    
    this.salesForm.get('name')?.valueChanges.subscribe((text) => {
      const dropdownControl = this.salesForm.get('product_id');

      if (text && text.length > 0) {
        
        dropdownControl?.disable({ emitEvent: false });
        dropdownControl?.setValue(''); 
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
