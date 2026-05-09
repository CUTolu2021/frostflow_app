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
import { CommonModule } from '@angular/common'
import { ToastService } from '../../services/toast.service'
import { ProductService } from '../../services/product.service'
import { Product } from '../../interfaces/product'
import { getErrorMessage } from '../../utils/error-message'

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
    isSubmittingSale = false
    paymentMethods: string[] = ['Cash', 'Card', 'Transfer']
    public name: string = localStorage.getItem('user_name') || ''
    email: string = localStorage.getItem('user_email') || ''
    id: string = localStorage.getItem('user_id') || ''

    constructor(
        private supabase: SupabaseService,
        private fb: FormBuilder,
        private toast: ToastService,
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
        this.setupDailySalesFormListeners()

        effect(() => {
            this.products = this.productService.products();
        });
    }

    async ngOnInit(): Promise<void> {
        this.salesMetrics = await this.supabase.getSalesDashboardMetrics()
        this.todaySalesMetrics = await this.supabase.getTodaySalesMetrics()

        this.productService.startListening();
        await this.productService.loadProducts();
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

    trackByProductId(_: number, product: Product): string {
        return product.id;
    }

    private setupDailySalesFormListeners() {
        const productIdSignal = toSignal(
            this.dailySalesForm.get('product_id')!.valueChanges,
            { initialValue: this.dailySalesForm.get('product_id')?.value }
        )
        const unitTypeSignal = toSignal(
            this.dailySalesForm.get('unit_type')!.valueChanges,
            { initialValue: this.dailySalesForm.get('unit_type')?.value }
        )
        const quantitySignal = toSignal(
            this.dailySalesForm.get('quantity')!.valueChanges,
            { initialValue: this.dailySalesForm.get('quantity')?.value }
        )
        const unitPriceSignal = toSignal(
            this.dailySalesForm.get('unit_price')!.valueChanges,
            { initialValue: this.dailySalesForm.get('unit_price')?.value }
        )

        effect(() => {
            const selectedProductId = productIdSignal()
            const unitType = String(unitTypeSignal() || 'kg')
            const selected = this.products.find((item) => item.id === selectedProductId)
            if (!selected) return

            const fallbackPrice = Number(selected.unit_price || 0)
            const boxPrice = Number(selected.box_price || 0)
            const nextPrice = unitType === 'box'
                ? (boxPrice > 0 ? boxPrice : fallbackPrice)
                : fallbackPrice

            this.dailySalesForm.patchValue({ unit_price: nextPrice }, { emitEvent: false })
            this.syncDailySalesTotal()
        })

        effect(() => {
            quantitySignal()
            unitPriceSignal()
            this.syncDailySalesTotal()
        })
    }

    private syncDailySalesTotal() {
        const quantity = Number(this.dailySalesForm.get('quantity')?.value || 0)
        const unitPrice = Number(this.dailySalesForm.get('unit_price')?.value || 0)
        const total = quantity > 0 && unitPrice >= 0 ? quantity * unitPrice : 0
        this.dailySalesForm.patchValue({ total_price: total }, { emitEvent: false })
    }

    async onSalesRecordSubmit() {
        if (!this.dailySalesForm.valid || this.isSubmittingSale) {
            this.toast.show('Please fill the Daily Sales form correctly', 'error')
            return
        }

        this.isSubmittingSale = true
        try {
            await this.supabase.recordDailySale(this.dailySalesForm.getRawValue())
            this.toast.show('Daily Sales recorded successfully', 'success')
            this.salesMetrics = await this.supabase.getSalesDashboardMetrics()
            this.todaySalesMetrics = await this.supabase.getTodaySalesMetrics()
            await this.productService.loadProducts(true, true)

            this.dailySalesForm.reset({
                recorded_by: this.id,
                unit_type: 'kg',
                total_price: 0,
            })
        } catch (error: unknown) {
            this.toast.show(getErrorMessage(error, 'Failed to record daily sale'), 'error')
        } finally {
            this.isSubmittingSale = false
        }
    }

    ngOnDestroy() {
        this.productService.stopListening();
    }

    handleLogout() {
        localStorage.clear()
        this.supabase.signOut()
        this.toast.show('Logout successful!', 'logout')
        this.router.navigate(['/login'])
    }
}
