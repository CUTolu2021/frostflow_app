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


  constructor(
    private supabase: SupabaseService,
    private fb: FormBuilder, 
    private n8n: WebhookService,
    private router: Router
  ) {
    // Initialize the form
    this.stockForm = this.fb.group({
      name: ['', Validators.min(1)],
      product_id: ['', Validators.required], // Dropdown value
      quantity: [0, [Validators.required, Validators.min(1)]],
      unit_price: [0, [Validators.required, Validators.min(0)]]
    });

    this.salesPersonForm = this.fb.group({
      name: ['', Validators.min(1)],
      role:['sales'],
      email: ['', [Validators.required, Validators.email]],
    });
  
  }

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

      console.log('Sending to n8n:', this.salesPersonForm.value);
      console.log((this.salesPersonForm.value.name).split('')[0],"@password")
      this.n8n.sendSalesPerson(this.salesPersonForm.value,);
    } else {
      alert('Please fill the form correctly');
    }
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