import { Component, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { CommonModule } from '@angular/common'
import { SupabaseService } from '../../services/supabase.service'
import { FormsModule } from '@angular/forms'
import { ToastService } from '../../services/toast.service'

@Component({
    selector: 'app-reconciliation',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './reconciliation.component.html',
    styleUrls: ['./reconciliation.component.css'],
})
export class ReconciliationComponent implements OnInit {
    // Data State
    mismatches: any[] = []
    isLoading = true
    totalMismatches = 0
    criticalItems = 0
    highlightId: string | null = null

    // Modal State
    isModalOpen = false;
    selectedMismatch: any = null;
    resolutionType: 'owner' | 'sales' | 'manual' = 'owner';
    manualQty: number = 0;
    resolutionNote: string = '';

    constructor(
        private supabase: SupabaseService,
        private route: ActivatedRoute,
        private toast: ToastService
    ) { }

    ngOnInit() {
        this.route.queryParams.subscribe((params) => {
            this.highlightId = params['id'] || null
            this.loadData()
        })
    }

    async loadData() {
        this.isLoading = true
        this.mismatches = await this.supabase.getPendingMismatches()
        this.totalMismatches = this.mismatches.length
        this.criticalItems = this.mismatches.filter(
            (m) => m.difference > 5
        ).length
        this.isLoading = false

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

    // --- Modal Logic ---

    openResolveModal(item: any) {
        this.selectedMismatch = item;
        this.isModalOpen = true;

        // Default to Owner's count as it's usually the 'Gold Standard' or at least the baseline
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

    async processResolution(item: any, finalQty: number, note: string) {
        try {
            await this.supabase.resolveMismatch(item, finalQty, note)
            this.toast.show('Mismatch resolved successfully', 'success');
            // No alert() needed, UI updates automatically or via toast if we added it
            this.loadData()
        } catch (error) {
            console.error(error)
            this.toast.show('Failed to resolve mismatch', 'error');
        }
    }
}
