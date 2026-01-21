import { Component, OnDestroy, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import {
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms'
import { SupabaseService } from '../../services/supabase.service'
import { WebhookService } from '../../services/webhook.service'
import { Router } from '@angular/router'
import { ToastService } from '../../services/toast.service'

@Component({
    selector: 'app-owner-dashboard',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './owner-dashboard.component.html',
    styleUrls: ['./owner-dashboard.component.css'],
})
export class OwnerDashboardComponent implements OnInit, OnDestroy {
    products: any[] = []
    lowStockItems: any[] = []
    recentActivity: any[] = []
    notifications: any[] = []
    showDropdown = false
    metrics = {
        totalValue: 0,
        lowStock: 0,
        totalItems: 0,
    }
    salesMetrics = {
        totalSalesValue: 0,
        totalUnitsSold: 0,
    }
    showUnitCostField: boolean = false

    private productSubscription: any
    private salesSubscription: any
    stockForm: FormGroup
    passwordVisible: boolean = false
    public name: string = localStorage.getItem('user_name') || ''
    email: string = localStorage.getItem('user_email') || ''
    id: string = localStorage.getItem('user_id') || ''
    stockEntryStatus = { ownerReady: false, salesReady: false }

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
            unit_type: ['box', [Validators.required, Validators.min(0)]],
            unit_price: [null, [Validators.required, Validators.min(0)]],
            total_cost: [0, [Validators.min(0)]],
            recorded_by: [this.id || '', [Validators.required]],
            unit_cost: [null, [Validators.required, Validators.min(0)]],
            total_weight: [null, [Validators.min(0)]],
            logistics_fee: [null, [Validators.min(0)]],
            box_price: [null, [Validators.min(0)]],
        })
    }

    async ngOnInit() {
        this.setupFormListeners()
        this.loadData()

        // Realtime Subscriptions
        this.supabase.subscribeToNotifications((payload) => {
            this.notifications.unshift(payload.new)
        })

        this.productSubscription = this.supabase.subscribeToProductChanges(() => {
            this.loadProducts()
        });

        // Listen to new sales for the feed
        // (Assuming subscribeToSales exists or I create a generic one. 
        //  The existing one is subscribeToStaffStockChanges which is stock_in_staff? 
        //  Wait, sales table updates? I'll re-use productSubscription for now as sales trigger product updates)
    }

    ngOnDestroy() {
        if (this.productSubscription) this.productSubscription.unsubscribe()
    }

    async loadData() {
        // 1. Products & Low Stock
        this.products = await this.supabase.getProducts()
        this.lowStockItems = this.products.filter(p => (p.unit || 0) < 10);

        // 2. Metrics
        this.metrics = await this.supabase.getDashboardMetrics()
        this.salesMetrics = await this.supabase.getSalesDashboardMetrics()

        // 3. Notifications
        this.notifications = await this.supabase.getUnreadNotifications()

        // 4. Live Activity Feed (Recent Sales)
        const sales = await this.supabase.getRecentSales(); // Returns last 50
        this.recentActivity = sales.slice(0, 10).map((s: any) => ({
            type: 'sale',
            user: s.users?.name || 'Staff',
            description: `${s.quantity} ${s.unit_type} of ${s.products?.name}`,
            time: new Date(s.created_at),
            amount: s.total_price
        }));
    }

    toggleNotifications() {
        this.showDropdown = !this.showDropdown
    }

    async onNotificationClick(notif: any) {
        await this.supabase.markNotificationAsRead(notif.id)
        this.notifications = this.notifications.filter((n) => n.id !== notif.id)
        // if (notif.link) this.router.navigate([notif.link])
    }

    loadProducts() {
        this.supabase.getProducts().then(data => {
            this.products = data;
            this.lowStockItems = this.products.filter(p => (p.unit || 0) < 10);
        });
    }

    onSubmit() {
        if (this.stockForm.valid) {
            this.n8n.sendOwnerStock(this.stockForm.value)
            this.toast.show('Stock recorded successfully!', 'success')
            this.stockForm.reset({
                recorded_by: this.id || '',
                unit_type: 'box',
                unit_price: null,
                logistics_fee: 0,
                box_price: null,
            })
            // Refresh feed maybe?
            setTimeout(() => this.loadData(), 1000);
        } else {
            this.toast.show('Please fill the form correctly.', 'error')
        }
    }

    handleLogout() {
        localStorage.clear()
        this.supabase.signOut()
        this.toast.show('Logout successful!', 'logout')
        this.router.navigate(['/login'])
    }

    // Form logic
    setupFormListeners() {
        this.stockForm.get('product_id')?.valueChanges.subscribe((selectedId) => {
            const nameControl = this.stockForm.get('name')
            if (selectedId) {
                nameControl?.disable({ emitEvent: false })
                nameControl?.setValue('')
            } else {
                nameControl?.enable({ emitEvent: false })
            }
        })

        this.stockForm.get('name')?.valueChanges.subscribe((text) => {
            const dropdownControl = this.stockForm.get('product_id')
            if (text && text.length > 0) {
                this.showUnitCostField = true
                dropdownControl?.disable({ emitEvent: false })
                dropdownControl?.setValue('')
                this.stockForm.get('unit_cost')?.setValue(0)
            } else {
                this.showUnitCostField = false
                dropdownControl?.enable({ emitEvent: false })
            }
        })
    }
}
