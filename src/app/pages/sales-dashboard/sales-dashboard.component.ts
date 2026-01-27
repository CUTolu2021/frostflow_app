import { Component, effect } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import {
    FormGroup,
    FormBuilder,
    Validators,
    ReactiveFormsModule,
} from '@angular/forms'
import { Router } from '@angular/router'
import { SupabaseService } from '../../services/supabase.service'
import { WebhookService } from '../../services/webhook.service'
import { CommonModule } from '@angular/common'
import { ToastService } from '../../services/toast.service'
import { ProductService } from '../../services/product.service'
import { Product } from '../../interfaces/product'
import { RealtimeChannel } from '@supabase/supabase-js'

@Component({
    selector: 'app-sales-dashboard',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './sales-dashboard.component.html',
    styleUrl: './sales-dashboard.component.css',
})
export class SalesDashboardComponent {
    products: Product[] = []
    salesForm: FormGroup
    dailySalesForm: FormGroup
    salesMetrics = {
        totalSalesValue: 0,
        totalUnitsSold: 0,
    }
    todaySalesMetrics = {
        todaySalesValue: 0,
        todayUnitsSold: 0,
    }
    private productSubscription?: RealtimeChannel
    paymentMethods: string[] = ['Cash', 'Card', 'Transfer']
    public name: string = localStorage.getItem('user_name') || ''
    email: string = localStorage.getItem('user_email') || ''
    id: string = localStorage.getItem('user_id') || ''

    constructor(
        private supabase: SupabaseService,
        private fb: FormBuilder,
        private toast: ToastService,
        private n8n: WebhookService,
        private router: Router,
        public productService: ProductService
    ) {
        this.salesForm = this.fb.group({
            name: ['', Validators.minLength(1)],
            product_id: ['', Validators.required],
            quantity: [null, [Validators.required, Validators.min(1)]],
            recorded_by: [this.id, Validators.required],
            unit_type: ['kg', [Validators.required, Validators.min(0)]],
        })

        this.dailySalesForm = this.fb.group({
            product_id: ['', Validators.required],
            quantity: [null, [Validators.required, Validators.min(1)]],
            unit_price: [null, [Validators.required, Validators.min(0)]],
            unit_type: ['kg', [Validators.required, Validators.min(0)]],
            total_price: [0, [Validators.required, Validators.min(0)]],
            payment_method: ['', Validators.required],
            recorded_by: [this.id, Validators.required],
        })
        this.setupFormListeners()

        effect(() => {
            this.products = this.productService.products();
        });
    }

    async ngOnInit(): Promise<void> {
        this.salesMetrics = await this.supabase.getSalesDashboardMetrics()
        this.todaySalesMetrics = await this.supabase.getTodaySalesMetrics()


        this.productService.loadProducts();
    }

    setupFormListeners() {
        const productIdSignal = toSignal(
            this.salesForm.get('product_id')!.valueChanges,
            { initialValue: this.salesForm.get('product_id')?.value }
        )

        const nameSignal = toSignal(this.salesForm.get('name')!.valueChanges, {
            initialValue: this.salesForm.get('name')?.value,
        })

        effect(() => {
            const selectedId = productIdSignal()
            const nameControl = this.salesForm.get('name')

            if (selectedId) {
                nameControl?.disable({ emitEvent: false })
                nameControl?.setValue('')
            } else {
                nameControl?.enable({ emitEvent: false })
            }
        })

        effect(() => {
            const text = nameSignal()
            const dropdownControl = this.salesForm.get('product_id')

            if (text && text.length > 0) {
                dropdownControl?.disable({ emitEvent: false })
                dropdownControl?.setValue('')
            } else {
                dropdownControl?.enable({ emitEvent: false })
            }
        })
    }

    onSalesRecordSubmit() {
        if (this.dailySalesForm.valid) {
            this.n8n.sendDailySales(this.dailySalesForm.value)
            this.toast.show('Daily Sales Recorded Successfully', 'success')
        } else {
            this.toast.show(
                'Please fill the Daily Sales form correctly',
                'error'
            )
        }

        this.dailySalesForm.reset({
            recorded_by: this.id,
            unit_type: 'kg',
        })
    }

    ngOnDestroy() {
        if (this.productSubscription) {
            this.productSubscription.unsubscribe()
        }
    }

    handleLogout() {
        localStorage.clear()
        this.supabase.signOut()
        this.toast.show('Logout successful!', 'logout')
        this.router.navigate(['/login'])
    }
}
