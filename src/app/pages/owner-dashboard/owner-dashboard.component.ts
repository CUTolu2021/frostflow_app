import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'; 
import { SupabaseService } from '../../services/supabase.service';
import { WebhookService } from '../../services/webhook.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-owner-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule], 
  templateUrl: './owner-dashboard.component.html',
  styleUrls: ['./owner-dashboard.component.css']
})
export class OwnerDashboardComponent implements OnInit, OnDestroy {
  products: any[] = [];
  metrics = {
    totalValue: 0,
    lowStock: 0,
    totalItems: 0
  };
  showUnitCostField: boolean = false;
  
  private refreshInterval: any;
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
    
    this.stockForm = this.fb.group({
      name: ['', Validators.min(1)],
      product_id: ['', Validators.required], 
      quantity: [[Validators.required, Validators.min(1)]],
      unit_price: [ [Validators.required, Validators.min(0)]],
      total_cost: [ [Validators.required, Validators.min(0)]],
      recorded_by: [this.email, Validators.required],
      unit_cost: [ [Validators.min(0)]]
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

    this.loadData();
    
    
    this.refreshInterval = setInterval(() => {
      this.loadData();
    }, 30000); 
  }

  ngOnDestroy() {
    
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  async loadData() {
    console.log('Refreshing Dashboard Data...');
    
    
    this.products = await this.supabase.getProducts();

    
    this.metrics = await this.supabase.getDashboardMetrics();
  }
  
  setupFormListeners() {
    
    this.stockForm.get('product_id')?.valueChanges.subscribe((selectedId) => {
      const nameControl = this.stockForm.get('name');
      
      if (selectedId) {
        
        nameControl?.disable({ emitEvent: false }); 
        nameControl?.setValue(''); 
      } else {
        
        nameControl?.enable({ emitEvent: false });
      }
    });

    
    this.stockForm.get('name')?.valueChanges.subscribe((text) => {
      const dropdownControl = this.stockForm.get('product_id');

      if (text && text.length > 0) {
        this.showUnitCostField = true;
        
        dropdownControl?.disable({ emitEvent: false });
        dropdownControl?.setValue('');
        this.stockForm.get('unit_cost')?.setValue(0);
      } else {
        
        this.showUnitCostField = false;
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