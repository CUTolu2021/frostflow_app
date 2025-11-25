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
  salesForm: FormGroup; // <--- This holds your form logic

  constructor(
    private supabase: SupabaseService,
    private fb: FormBuilder, // <--- Inject FormBuilder
    private n8n: WebhookService,
    private router: Router
  ) {
    // Initialize the form
    this.salesForm = this.fb.group({
      product_id: ['', Validators.required], // Dropdown value
      quantity: [0, [Validators.required, Validators.min(1)]],
      unit_price: [0, [Validators.required, Validators.min(0)]]
    });
  }

  ngOnInit(): void {
    this.loadProducts();
    this.setupFormListeners();
  }

  setupFormListeners() {
    // 1. Listen to Dropdown Changes
    this.salesForm.get('product_id')?.valueChanges.subscribe((selectedId) => {
      const nameControl = this.salesForm.get('name');
      
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
      this.n8n.sendOwnerStock(this.salesForm.value);
    } else {
      alert('Please fill the form correctly');
    }
  }

  handleLogout() {
    localStorage.clear();
    this.supabase.signOut();
    this.router.navigate(['/login']);
  }

}
