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
import Decimal from 'decimal.js'

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
    userRole: string = localStorage.getItem('user_role') || ''
    isAdminView = false

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
            quantity: [null, [Validators.required, Validators.min(0.001)]],
            recorded_by: [this.id, Validators.required],
            unit_type: ['kg', [Validators.required, Validators.min(0)]],
        })

        this.dailySalesForm = this.fb.group({
            product_id: ['', Validators.required],
            quantity: [null, [Validators.required, Validators.min(0.001)]],
            unit_price: [null, [Validators.required, Validators.min(0)]],
            unit_type: ['', Validators.required],
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
        this.isAdminView = this.userRole === 'admin' || this.userRole === 'manager'
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

    private normalizeUnit(unit: string | null | undefined): string {
        return String(unit || 'kg').trim().toLowerCase();
    }

    private getBaseUnit(product: Product | null): string {
        return this.normalizeUnit(product?.base_unit || 'kg');
    }

    private supportsBoxUnit(product: Product | null): boolean {
        if (!product) return false;
        return Boolean(
            product.is_variable_weight
            || Number(product.standard_box_weight || 0) > 0
            || Number(product.box_price || 0) > 0
            || this.getBaseUnit(product) === 'box'
        );
    }

    private getSaleUnitValuesForProduct(product: Product | null): string[] {
        if (!product) return ['kg'];
        const base = this.getBaseUnit(product);
        const values = [base];
        if (this.supportsBoxUnit(product) && base !== 'box') {
            values.push('box');
        }
        return values;
    }

    getSaleUnitOptions(): Array<{ value: string; label: string }> {
        const product = this.getSelectedProduct();
        const values = this.getSaleUnitValuesForProduct(product);
        return values.map((value) => ({
            value,
            label: value === 'box' ? 'Box / Carton' : this.getUnitDisplay(value),
        }));
    }

    getUnitDisplay(unit: string | null | undefined): string {
        const normalized = this.normalizeUnit(unit);
        if (normalized === 'kg') return 'KG';
        if (normalized === 'pcs') return 'Pieces';
        if (normalized === 'liters') return 'Liters';
        if (normalized === 'box') return 'Box';
        return normalized || 'Unit';
    }

    getCurrentPriceUnitLabel(): string {
        return this.getUnitDisplay(this.dailySalesForm.get('unit_type')?.value || this.getBaseUnit(this.getSelectedProduct()));
    }

    getStockUnitLabel(product: Product): string {
        return this.getUnitDisplay(product.base_unit);
    }

    private getSelectedProduct(): Product | null {
        const productId = String(this.dailySalesForm.get('product_id')?.value || '');
        if (!productId) return null;
        return this.products.find((item) => item.id === productId) || null;
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
            const unitTypeRaw = String(unitTypeSignal() || '')
            const selected = this.products.find((item) => item.id === selectedProductId)
            if (!selected) return

            const unitOptions = this.getSaleUnitValuesForProduct(selected);
            let unitType = this.normalizeUnit(unitTypeRaw);
            if (!unitOptions.includes(unitType)) {
                unitType = unitOptions[0];
                this.dailySalesForm.patchValue({ unit_type: unitType }, { emitEvent: false });
            }

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
        const quantityValue = this.dailySalesForm.get('quantity')?.value
        const unitPriceValue = this.dailySalesForm.get('unit_price')?.value

        let total = 0
        try {
            const quantity = new Decimal(String(quantityValue || 0))
            const unitPrice = new Decimal(String(unitPriceValue || 0))
            total = quantity.gt(0) && unitPrice.gte(0)
                ? quantity.mul(unitPrice).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
                : 0
        } catch {
            total = 0
        }

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
                unit_type: '',
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
