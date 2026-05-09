import { Component, OnInit, Signal, effect } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { ActivatedRoute, Params } from '@angular/router'
import { CommonModule } from '@angular/common'
import { SupabaseService } from '../../services/supabase.service'
import { FormsModule } from '@angular/forms'
import { ToastService } from '../../services/toast.service'
import { ProductService } from '../../services/product.service'

import { ReconciliationMismatch, statusEnum } from '../../interfaces/reconciliation'
import { getErrorMessage } from '../../utils/error-message'

@Component({
    selector: 'app-reconciliation',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './reconciliation.component.html',
    styleUrls: ['./reconciliation.component.css'],
})
export class ReconciliationComponent implements OnInit {

    mismatches: ReconciliationMismatch[] = []
    isLoading = true
    totalMismatches = 0
    criticalItems = 0
    highlightId: string | null = null
    statusEnum = statusEnum
    isRunningCheck = false;


    isModalOpen = false;
    selectedMismatch: ReconciliationMismatch | null = null;
    resolutionType: 'owner' | 'sales' | 'manual' = 'owner';
    manualQty: number = 0;
    resolutionNote: string = '';

    queryParams: Signal<Params | undefined>;

    constructor(
        private supabase: SupabaseService,
        private route: ActivatedRoute,
        private toast: ToastService,
        private productService: ProductService
    ) {
        this.queryParams = toSignal(this.route.queryParams);

        effect(() => {
            const params = this.queryParams();
            if (params) {
                this.highlightId = params['id'] || null
                this.loadData()
            }
        });
    }

    ngOnInit() {

    }

    getStatusLabel(status: string): string {
        const key = String(status || '').toUpperCase();
        const statusMap = this.statusEnum as unknown as Record<string, string>;
        return statusMap[key] || key.replace(/_/g, ' ');
    }

    formatUnitList(units: string[] | undefined): string {
        const values = (units || []).filter(Boolean);
        if (!values.length) return 'kg';
        return values.join(', ');
    }

    getNormalizedUnitLabel(item: ReconciliationMismatch): string {
        return String(item.normalized_unit || 'kg').toLowerCase();
    }

    async loadData() {
        this.isLoading = true
        try {
            this.mismatches = await this.supabase.getPendingMismatches()
            this.totalMismatches = this.mismatches.length
            this.criticalItems = this.mismatches.filter(
                (m) => m.difference > 5
            ).length
        } catch (error: unknown) {
            this.toast.show(getErrorMessage(error, 'Failed to load mismatch data'), 'error');
            this.mismatches = [];
            this.totalMismatches = 0;
            this.criticalItems = 0;
        } finally {
            this.isLoading = false
        }

        if (this.highlightId) {
            setTimeout(() => {
                const el = document.getElementById(
                    'mismatch-' + this.highlightId
                )
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
            }, 200)

            setTimeout(() => {
                this.highlightId = null
            }, 3000)
        }
    }

    async runCheckNow() {
        this.isRunningCheck = true;
        try {
            const summary = await this.supabase.runReconciliationNow();
            this.toast.show(
                `Check complete: ${summary.totalProductsChecked} products, ${summary.escalatedCount} escalated.`,
                'success'
            );
            await this.productService.loadProducts(true, true);
            await this.loadData();
        } catch (error: unknown) {
            this.toast.show(getErrorMessage(error, 'Failed to run reconciliation check'), 'error');
        } finally {
            this.isRunningCheck = false;
        }
    }



    openResolveModal(item: ReconciliationMismatch) {
        this.selectedMismatch = item;
        this.isModalOpen = true;


        this.resolutionType = 'owner';
        this.manualQty = item.owner_quantity;
        this.resolutionNote = '';
    }

    closeModal() {
        this.isModalOpen = false;
        this.selectedMismatch = null;
    }

    setResolution(type: 'owner' | 'sales' | 'manual') {
        this.resolutionType = type;
        if (!this.selectedMismatch) return;

        if (type === 'owner') {
            this.manualQty = this.selectedMismatch.owner_quantity;
        } else if (type === 'sales') {
            this.manualQty = this.selectedMismatch.staff_quantity || 0;
        }
    }

    async confirmResolution() {
        if (!this.selectedMismatch) return;

        if (this.resolutionType === 'manual' && this.manualQty < 0) {
            this.toast.show('Quantity cannot be negative', 'error');
            return;
        }

        let note = this.resolutionNote;
        if (!note) {
            if (this.resolutionType === 'owner') note = 'Owner count accepted via Admin';
            if (this.resolutionType === 'sales') note = 'Sales count accepted via Admin';
            if (this.resolutionType === 'manual') note = 'Manual Admin Override';
        }

        await this.processResolution(this.selectedMismatch, this.manualQty, note);
        this.closeModal();
    }

    async processResolution(item: ReconciliationMismatch, finalQty: number, note: string) {
        try {
            await this.supabase.resolveMismatch(item, finalQty, note)
            await this.productService.loadProducts(true, true);
            this.toast.show('Mismatch resolved successfully', 'success');

            this.loadData()
        } catch (error) {
            console.error(error)
            this.toast.show('Failed to resolve mismatch', 'error');
        }
    }
}
