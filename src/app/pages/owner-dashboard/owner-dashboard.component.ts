import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'; 
import { SupabaseService } from '../../services/supabase.service';
import { WebhookService } from '../../services/webhook.service';
import { Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-owner-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule], 
  templateUrl: './owner-dashboard.component.html',
  styleUrls: ['./owner-dashboard.component.css']
})
export class OwnerDashboardComponent implements OnInit, OnDestroy {
  products: any[] = [];
  reportData: any = [];
  notifications: any[] = [];
  showDropdown = false;
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
  id: string = localStorage.getItem('user_id') || '';
  reconcileReady = false;
  stockEntryStatus = { ownerReady: false, salesReady: false };


  constructor(
    private supabase: SupabaseService,
    private fb: FormBuilder, 
    private n8n: WebhookService,
    private toast: ToastService,
    private router: Router
  ) {
    
    this.stockForm = this.fb.group({
      name: ['', [Validators.minLength(1)]],
      product_id: [''],
      quantity: [null, [Validators.required, Validators.min(1)]],
      unit_price: [null, [Validators.required, Validators.min(0)]],
      total_cost: [null, [Validators.required, Validators.min(0)]],
      recorded_by: [this.id || '', [Validators.required]],
      unit_cost: [null, [Validators.min(0)]]
    });

    this.salesPersonForm = this.fb.group({
      name: ['', [Validators.minLength(1)]],
      role: ['sales'],
      email: ['', [Validators.required, Validators.email]],
    });
  
  }


  async ngOnInit() {
    this.loadProducts();
    this.setupFormListeners();

    this.loadData();
    
    // Load report data early to prevent template undefined errors
    const reports = await this.supabase.getAIReports();
    this.reportData = reports && reports.length > 0 ? reports[0] : null;
    
    // Load initial
    this.notifications = await this.supabase.getUnreadNotifications();
    
    // Listen for new ones from n8n
    this.supabase.subscribeToNotifications((payload) => {
      // Add new alert to the top of the list
      this.notifications.unshift(payload.new);
      // Optional: Play a sound here?
    });
    
    
    // this.refreshInterval = setInterval(() => {
    //   this.loadData();
    // }, 30000);
    await this.checkStatus();
  }

  async checkStatus() {
  this.stockEntryStatus = await this.supabase.getDailyEntryStatus();
  
  // LOGIC: Only ready if BOTH have entered data
  this.reconcileReady = this.stockEntryStatus.ownerReady && this.stockEntryStatus.salesReady;
}

async triggerReconciliation() {
  if (!this.reconcileReady) return;
  
  // Call n8n to run the math
  await this.n8n.triggerManualReconcile();
  this.toast.show('Reconciliation started...', 'info');
}

  toggleNotifications() {
    this.showDropdown = !this.showDropdown;
  }

  async onNotificationClick(notif: any) {
    // Mark as read in DB
    await this.supabase.markNotificationAsRead(notif.id);
    
    // Remove from UI list
    this.notifications = this.notifications.filter(n => n.id !== notif.id);
    
    // Navigate if there is a link
    if (notif.link) {
      // this.router.navigate([notif.link]);
    }
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
      this.toast.show('Stock recorded successfully!', 'success')
    } else {
      this.toast.show('Please fill the form correctly.', 'error');
    }
    this.stockForm.reset();

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
      this.toast.show('Sales person account created successfully!', 'success')
    } else {
      this.toast.show('Please fill the form correctly.', 'error');
    }
    this.salesPersonForm.reset();
  }


  handleLogout() {
    localStorage.clear();
    this.supabase.signOut();
    this.toast.show('Logout successful!', 'logout');
    this.router.navigate(['/login']);
  }

  togglePasswordVisibility() {
    this.passwordVisible = !this.passwordVisible;
  }

  trackByProductId(index: number, product: any) {
    return product.id;
  }

}