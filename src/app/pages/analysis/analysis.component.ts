import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';

@Component({
    selector: 'app-analysis',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './analysis.component.html',
    styleUrls: ['./analysis.component.css']
})
export class AnalysisComponent implements OnInit {
    activeTab: 'overview' | 'ai' | 'history' | 'expenses' = 'overview';
    currentMonth = new Date();

    // Data State
    metrics: any = { totalValue: 0, lowStock: 0, totalItems: 0 };
    salesMetrics: any = { totalSalesValue: 0, totalUnitsSold: 0 };
    aiReport: any = null;
    isLoading = true;

    // History Logic
    groupedSales: any[] = []; // The list of Invoices
    financials = {
        totalRevenue: 0,
        cashAtHand: 0,
        bankTransfer: 0,
        credit: 0
    };

    // Filters
    filters = {
        date: new Date().toISOString().slice(0, 7), // YYYY-MM
        staff: 'all',
        payment: 'all'
    };
    staffList: any[] = [];

    // Modal State
    selectedInvoice: any = null;
    isReceiptModalOpen = false;
    isVoidingMode = false;

    voidReason = '';

    // Expenses Logic
    expenses: any[] = [];
    expenseMetrics = {
        totalSpent: 0,
        goodsCost: 0,
        logisticsCost: 0,
        netProfit: 0 // Sales Revenue - Total Expenses
    };
    expenseChartData: any[] = []; // For trend chart

    currentUser: any = null;

    constructor(
        private supabase: SupabaseService,
        private toast: ToastService // Assuming you want toast feedback
    ) { }


    async refreshData() {
        await this.ngOnInit();
    }

    async ngOnInit() {
        this.isLoading = true;
        this.currentUser = await this.supabase.getCurrentUser();
        // Parallel load
        await Promise.all([
            this.loadMetrics(),
            this.loadAiReport(),
            this.loadHistory(),
            this.loadExpenses(), // New load
            this.loadStaff()
        ]);
        this.isLoading = false;
    }

    setActiveTab(tab: 'overview' | 'ai' | 'history' | 'expenses') {
        this.activeTab = tab;
    }

    async loadMetrics() {
        this.metrics = await this.supabase.getDashboardMetrics();
        this.metrics.totalValue = this.metrics.totalValue || 0;
        this.salesMetrics = await this.supabase.getSalesDashboardMetrics();
    }

    async loadAiReport() {
        const reports = await this.supabase.getAIReports();
        this.aiReport = reports && reports.length > 0 ? reports[0] : null;
    }

    async loadStaff() {
        this.staffList = await this.supabase.getStaffList();
    }

    // --- CORE HISTORY LOGIC ---

    getDateRange() {
        const [year, month] = this.filters.date.split('-').map(Number);
        const start = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`;
        const lastDay = new Date(year, month, 0).getDate();
        const end = `${year}-${String(month).padStart(2, '0')}-${lastDay}T23:59:59`;
        return { start, end };
    }

    async loadHistory() {
        // 1. Build Date Range (Month)
        const { start, end } = this.getDateRange();

        // 2. Fetch Raw Lines
        const rawSales = await this.supabase.getSalesHistory(start, end);

        // 3. Client-side Filtering (Staff/Payment)
        const filtered = rawSales.filter((s: any) => {
            if (this.filters.staff !== 'all' && s.recorded_by !== this.filters.staff) return false;
            // if (this.filters.payment !== 'all' && s.payment_method !== this.filters.payment) return false; 
            // NOTE: Grouping usually happens by Invoice, and an invoice usually has ONE payment method. 
            // If filtering by payment, we filter the whole invoice later or here. Let's do it here.
            if (this.filters.payment !== 'all' && s.payment_method !== this.filters.payment) return false;
            return true;
        });

        // 4. Group by Invoice ID
        const grouped: any = {};

        filtered.forEach((row: any) => {
            // Fallback invoice ID if older data didn't have one (generate pseudo from timestamp if needed, or skip)
            const id = row.invoice_id || `UNK-${new Date(row.created_at).getTime()}`;

            if (!grouped[id]) {
                grouped[id] = {
                    invoice_id: id,
                    raw_date: row.created_at,
                    time: new Date(row.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                    staff_name: row.users?.name || 'Unknown',
                    total: 0,
                    payment_method: row.payment_method,
                    status: row.status || 'completed', // 'completed' | 'void'
                    items: [],
                    item_summary: ''
                };
            }

            // Add lines
            grouped[id].items.push(row);
            // Sum totals (ensure we handle void logic visually, but data usually keeps the record)
            if (row.status !== 'void') {
                grouped[id].total += (row.total_price || 0);
            }
        });

        // 5. Finalize Groups (Summary text)
        this.groupedSales = Object.values(grouped).sort((a: any, b: any) =>
            new Date(b.raw_date).getTime() - new Date(a.raw_date).getTime()
        );

        this.groupedSales.forEach(g => {
            const names = g.items.map((i: any) => i.products?.name).join(', ');
            g.item_summary = `${g.items.length} Item(s): ${names}`;
            // If text too long, truncate? CSS handles truncation usually.
        });

        // 6. Calculate Financials (Snapshot)
        this.calculateFinancials();
    }

    calculateFinancials() {
        // Reset
        this.financials = { totalRevenue: 0, cashAtHand: 0, bankTransfer: 0, credit: 0 };

        this.groupedSales.forEach(inv => {
            if (inv.status === 'void') return; // Skip voided money

            this.financials.totalRevenue += inv.total;

            if (inv.payment_method === 'cash') this.financials.cashAtHand += inv.total;
            else if (inv.payment_method === 'transfer' || inv.payment_method === 'card') this.financials.bankTransfer += inv.total;
            else if (inv.payment_method === 'credit') this.financials.credit += inv.total;
        });
    }

    // --- VIEW / VOID ACTIONS ---

    viewReceipt(invoice: any) {
        this.selectedInvoice = invoice;
        this.isReceiptModalOpen = true;
    }

    closeReceiptModal() {
        this.isReceiptModalOpen = false;
        this.selectedInvoice = null;
        this.isVoidingMode = false;
        this.voidReason = '';
    }

    async voidTransaction(invoice: any) {
        if (!this.isVoidingMode) {
            this.isVoidingMode = true;
            return;
        }

        if (!this.voidReason || this.voidReason.trim().length < 5) {
            alert('Please provide a valid reason (min 5 characters)');
            return;
        }

        if (!confirm(`Are you sure you want to VOID Invoice #${invoice.invoice_id}? This will reverse stock and mark it as voided.`)) return;

        this.isLoading = true;
        try {
            // Loop items and void specific lines
            for (const item of invoice.items) {
                // Return stock and record reason
                await this.supabase.voidSale(
                    item.id,
                    item.product_id,
                    item.quantity,
                    this.voidReason
                );
            }

            alert('Invoice Voided Successfully');
            this.closeReceiptModal();
            await this.loadHistory(); // Reload to reflect changes

        } catch (error: any) {
            console.error(error);
            alert('Failed to void: ' + error.message);
        } finally {
            this.isLoading = false;
        }
    }


    // --- EXPENSES LOGIC ---

    async loadExpenses() {
        if (!this.currentUser) return;

        try {
            const { start, end } = this.getDateRange();

            const data = await this.supabase.getExpenses(start, end);
            this.expenses = data;

            this.calculateExpenseMetrics();

        } catch (error) {
            console.error('Error loading expenses:', error);
        }
    }

    calculateExpenseMetrics() {
        let total = 0;
        let goods = 0;
        let logistic = 0;

        this.expenses.forEach(e => {
            const cost = e.total_cost || 0;
            const fee = e.logistics_fee || 0;
            goods += cost;
            logistic += fee;
            total += (cost + fee);
        });

        this.expenseMetrics = {
            totalSpent: total,
            goodsCost: goods,
            logisticsCost: logistic,
            netProfit: this.financials.totalRevenue - total
        };
    }

    get formattedDate() {
        return new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        })
    }

    get recommendations(): string[] {
        return this.aiReport?.recommendations || []
    }
}
