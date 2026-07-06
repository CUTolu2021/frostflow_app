import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';
import { UserProfile } from '../../interfaces/profile';
import { GroupedSale, Sale } from '../../interfaces/sales';
import { AIStockReport } from '../../interfaces/ai-report';
import { CreateExpensePayload, ExpenseRecord } from '../../interfaces/expense';
import { AuthUser } from '../../interfaces/auth-user';
import { getErrorMessage } from '../../utils/error-message';
import { DialogService } from '../../services/dialog.service';

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


    metrics = { totalValue: 0, lowStock: 0, totalItems: 0, totalExpenses: 0 };
    salesMetrics = { totalSalesValue: 0, totalUnitsSold: 0 };
    aiReport: AIStockReport | null = null;
    isLoading = true;


    groupedSales: GroupedSale[] = [];
    financials = {
        totalRevenue: 0,
        cashAtHand: 0,
        bankTransfer: 0,
        credit: 0
    };


    historyFilters = {
        date: new Date().toISOString().slice(0, 7),
        staff: 'all',
        payment: 'all'
    };
    expenseFilters = {
        date: new Date().toISOString().slice(0, 7),
    };
    staffList: UserProfile[] = [];


    selectedInvoice: GroupedSale | null = null;
    isReceiptModalOpen = false;
    isVoidingMode = false;

    voidReason = '';


    expenses: ExpenseRecord[] = [];
    expenseMetrics = {
        totalSpent: 0,
        goodsCost: 0,
        logisticsCost: 0,
        miscCost: 0,
        netProfit: 0
    };
    expenseRevenueTotal = 0;

    isExpenseModalOpen = false;
    isSavingExpense = false;
    expenseForm: CreateExpensePayload = {
        description: '',
        category: '',
        amount: 0,
        expenseDate: new Date().toISOString().slice(0, 10),
        notes: '',
    };

    currentUser: AuthUser | null = null;

    constructor(
        private supabase: SupabaseService,
        private toast: ToastService,
        private dialog: DialogService
    ) { }


    async refreshData() {
        await this.ngOnInit();
    }

    async ngOnInit() {
        this.isLoading = true;
        this.currentUser = await this.supabase.getCurrentUser();

        await Promise.all([
            this.loadMetrics(),
            this.loadAiReport(),
            this.loadHistory(),
            this.loadExpenses(),
            this.loadStaff()
        ]);
        this.calculateExpenseMetrics();
        this.isLoading = false;
    }

    setActiveTab(tab: 'overview' | 'ai' | 'history' | 'expenses') {
        this.activeTab = tab;
    }

    openExpenseModal() {
        this.expenseForm = {
            description: '',
            category: '',
            amount: 0,
            expenseDate: new Date().toISOString().slice(0, 10),
            notes: '',
        };
        this.isExpenseModalOpen = true;
    }

    closeExpenseModal() {
        if (this.isSavingExpense) return;
        this.isExpenseModalOpen = false;
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



    private getRangeForMonth(monthValue: string) {
        const [year, month] = monthValue.split('-').map(Number);
        const start = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`;
        const lastDay = new Date(year, month, 0).getDate();
        const end = `${year}-${String(month).padStart(2, '0')}-${lastDay}T23:59:59`;
        return { start, end };
    }

    getHistoryDateRange() {
        return this.getRangeForMonth(this.historyFilters.date);
    }

    getExpenseDateRange() {
        return this.getRangeForMonth(this.expenseFilters.date);
    }

    async loadHistory() {

        const { start, end } = this.getHistoryDateRange();


        const rawSales = await this.supabase.getSalesHistory(start, end);


        const filtered = rawSales.filter((s: Sale) => {
            if (this.historyFilters.staff !== 'all' && s.recorded_by !== this.historyFilters.staff) return false;
            if (this.historyFilters.payment !== 'all' && !this.matchesPaymentFilter(s, this.historyFilters.payment)) return false;
            return true;
        });


        const grouped: { [key: string]: GroupedSale } = {};

        filtered.forEach((row: Sale) => {

            const id = row.invoice_id || `UNK-${new Date(row.created_at).getTime()}`;

            if (!grouped[id]) {
                grouped[id] = {
                    invoice_id: id,
                    raw_date: row.created_at,
                    time: new Date(row.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                    staff_name: row.users?.name || 'Unknown',
                    total: 0,
                    payment_method: row.payment_method,
                    status: row.status || 'completed',
                    items: [],
                    item_summary: '',
                    payment_summary: '',
                    payments: [],
                };
            }


            grouped[id].items.push(row);

            if (row.status !== 'voided' && row.status !== 'rejected') {
                grouped[id].total += Number(row.total_price || 0);
            }
        });


        this.groupedSales = Object.values(grouped).sort((a: GroupedSale, b: GroupedSale) =>
            new Date(b.raw_date).getTime() - new Date(a.raw_date).getTime()
        );

        this.groupedSales.forEach(g => {
            const preview = g.items
                .map((item: Sale) => this.formatSaleLine(item))
                .slice(0, 3)
                .join(' | ');
            const remaining = g.items.length > 3 ? ` +${g.items.length - 3} more` : '';
            g.item_summary = `${preview}${remaining}`;
            g.payments = this.flattenPayments(g.items);
            g.payment_summary = this.buildPaymentSummary(g.payments);
        });


        this.calculateFinancials();
        this.calculateExpenseMetrics();
    }

    calculateFinancials() {

        this.financials = { totalRevenue: 0, cashAtHand: 0, bankTransfer: 0, credit: 0 };

        this.groupedSales.forEach(inv => {
            if (inv.status === 'voided' || inv.status === 'rejected') return;

            this.financials.totalRevenue += Number(inv.total || 0);
            const payments = inv.payments || [];
            if (!payments.length) {
                const method = String(inv.payment_method || '').toLowerCase();
                if (method === 'cash') this.financials.cashAtHand += Number(inv.total || 0);
                else if (method === 'transfer' || method === 'card' || method === 'mixed') this.financials.bankTransfer += Number(inv.total || 0);
                else if (method === 'credit') this.financials.credit += Number(inv.total || 0);
                return;
            }

            payments.forEach((payment) => {
                if (payment.method === 'cash') this.financials.cashAtHand += Number(payment.amount || 0);
                else if (payment.method === 'transfer' || payment.method === 'card') this.financials.bankTransfer += Number(payment.amount || 0);
                else if (payment.method === 'credit') this.financials.credit += Number(payment.amount || 0);
            });
        });
    }

    private flattenPayments(items: Sale[]) {
        return items.flatMap((item) => item.sale_payments || []);
    }

    private buildPaymentSummary(payments: Sale['sale_payments'] = []): string {
        if (!payments || payments.length === 0) return 'N/A';
        const totals = new Map<string, number>();
        payments.forEach((payment) => {
            const method = String(payment.method || '').toLowerCase();
            totals.set(method, (totals.get(method) || 0) + Number(payment.amount || 0));
        });
        return Array.from(totals.entries())
            .map(([method, amount]) => `${method}: ${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
            .join(' | ');
    }

    private matchesPaymentFilter(sale: Sale, filter: string): boolean {
        const normalizedFilter = String(filter || '').toLowerCase();
        if (String(sale.payment_method || '').toLowerCase() === normalizedFilter) return true;
        return (sale.sale_payments || []).some((payment) => String(payment.method || '').toLowerCase() === normalizedFilter);
    }

    getUnitLabel(unitType: string | null | undefined): string {
        const normalized = String(unitType || '').trim().toLowerCase();
        if (normalized === 'kg') return 'KG';
        if (normalized === 'pcs') return 'Pieces';
        if (normalized === 'liters') return 'Liters';
        if (normalized === 'box' || normalized === 'carton') return 'Box';
        return normalized || 'Unit';
    }

    formatSaleLine(item: Sale): string {
        const productName = item.products?.name || 'Unknown Product';
        return `${item.quantity} ${this.getUnitLabel(item.unit_type)} ${productName}`;
    }



    viewReceipt(invoice: GroupedSale) {
        this.selectedInvoice = invoice;
        this.isReceiptModalOpen = true;
    }

    closeReceiptModal() {
        this.isReceiptModalOpen = false;
        this.selectedInvoice = null;
        this.isVoidingMode = false;
        this.voidReason = '';
    }

    async voidTransaction(invoice: GroupedSale) {
        if (this.isLoading) return;

        if (!this.isVoidingMode) {
            this.isVoidingMode = true;
            return;
        }

        if (!this.voidReason || this.voidReason.trim().length < 5) {
            this.toast.show('Please provide a valid reason (at least 5 characters).', 'error');
            return;
        }

        const confirmed = await this.dialog.confirm({
            title: 'Void Invoice',
            message: `Are you sure you want to void invoice #${invoice.invoice_id}? This will reverse stock and mark it as voided.`,
            confirmText: 'Void Invoice',
            cancelText: 'Cancel',
            tone: 'danger',
        });
        if (!confirmed) return;

        this.isLoading = true;
        try {

            for (const item of invoice.items) {

                await this.supabase.voidSale(
                    item.id,
                    item.product_id,
                    item.quantity,
                    this.voidReason
                );
            }

            this.toast.show('Invoice voided successfully.', 'success');
            this.closeReceiptModal();
            await this.loadHistory();

        } catch (error: unknown) {
            console.error(error);
            this.toast.show(getErrorMessage(error, 'Failed to void invoice'), 'error');
        } finally {
            this.isLoading = false;
        }
    }




    async loadExpenses() {
        if (!this.currentUser) return;

        try {
            const { start, end } = this.getExpenseDateRange();
            const [data, sales] = await Promise.all([
                this.supabase.getExpenses(start, end),
                this.supabase.getSalesHistory(start, end),
            ]);
            this.expenses = data;
            this.expenseRevenueTotal = sales.reduce((sum, sale) => {
                if (sale.status === 'voided' || sale.status === 'rejected') return sum;
                return sum + Number(sale.total_price || 0);
            }, 0);

            this.calculateExpenseMetrics();

        } catch (error) {
            console.error('Error loading expenses:', error);
        }
    }

    calculateExpenseMetrics() {
        let total = 0;
        let goods = 0;
        let logistic = 0;
        let misc = 0;

        this.expenses.forEach(e => {
            const cost = Number(e.goods_cost || 0);
            const fee = Number(e.logistics_fee || 0);
            const amount = Number(e.amount || 0);
            goods += cost;
            logistic += fee;
            total += amount;
            if (e.expense_type === 'misc') {
                misc += amount;
            }
        });

        this.expenseMetrics = {
            totalSpent: total,
            goodsCost: goods,
            logisticsCost: logistic,
            miscCost: misc,
            netProfit: this.expenseRevenueTotal - total
        };
    }

    async submitExpense() {
        if (this.isSavingExpense) return;

        const payload: CreateExpensePayload = {
            description: this.expenseForm.description.trim(),
            category: this.expenseForm.category.trim(),
            amount: Number(this.expenseForm.amount),
            expenseDate: this.expenseForm.expenseDate,
            notes: this.expenseForm.notes?.trim() || '',
        };

        if (!payload.description || !payload.category || !payload.expenseDate || !Number.isFinite(payload.amount) || payload.amount <= 0) {
            this.toast.show('Please enter a valid description, category, amount, and expense date.', 'error');
            return;
        }

        this.isSavingExpense = true;
        try {
            await this.supabase.createExpense(payload);
            this.toast.show('Expense recorded successfully.', 'success');
            this.isExpenseModalOpen = false;
            await this.loadExpenses();
        } catch (error: unknown) {
            this.toast.show(getErrorMessage(error, 'Failed to record expense'), 'error');
        } finally {
            this.isSavingExpense = false;
        }
    }

    getExpenseTypeLabel(expense: ExpenseRecord): string {
        return expense.expense_type === 'misc' ? 'Misc Expense' : 'Stock Purchase';
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
