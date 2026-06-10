import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { Sale, GroupedSale } from '../../interfaces/sales';
import { AuthUser } from '../../interfaces/auth-user';

@Component({
  selector: 'app-sales-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sales-history.component.html',
  styleUrl: './sales-history.component.css'
})
export class SalesHistoryComponent implements OnInit {
  isLoading = true;
  currentUser: AuthUser | null = null;


  groupedSales: GroupedSale[] = [];
  financials = {
    myTotal: 0,
    myCash: 0,
    myTransfers: 0
  };


  selectedDate: string = new Date().toISOString().split('T')[0];


  selectedInvoice: GroupedSale | null = null;
  isModalOpen = false;

  constructor(private supabase: SupabaseService) { }

  async ngOnInit() {
    this.isLoading = true;
    this.currentUser = await this.supabase.getCurrentUser();
    if (this.currentUser) {
      await this.loadMyHistory();
    }
    this.isLoading = false;
  }

  async loadMyHistory() {
    if (!this.currentUser) return;

    const start = `${this.selectedDate}T00:00:00.000Z`;
    const end = `${this.selectedDate}T23:59:59.999Z`;



    const allSales = await this.supabase.getSalesHistory(start, end);


    const mySales = allSales.filter((s: Sale) => s.recorded_by === this.currentUser?.id);


    const grouped: { [key: string]: GroupedSale } = {};
    mySales.forEach((row: Sale) => {
      const id = row.invoice_id || `UNK-${new Date(row.created_at).getTime()}`;
      if (!grouped[id]) {
        grouped[id] = {
          invoice_id: id,
          staff_name: row.users?.name || 'Unknown',
          time: new Date(row.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          raw_date: row.created_at,
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

    this.groupedSales.forEach((sale) => {
      sale.payments = sale.items.flatMap((item) => item.sale_payments || []);
      sale.payment_summary = this.buildPaymentSummary(sale);
    });

    this.calculateFinancials();
  }

  calculateFinancials() {
    this.financials = { myTotal: 0, myCash: 0, myTransfers: 0 };
    this.groupedSales.forEach(inv => {
      if (inv.status === 'voided' || inv.status === 'rejected') return;

      this.financials.myTotal += Number(inv.total || 0);
      if (inv.payments && inv.payments.length > 0) {
        inv.payments.forEach((payment) => {
          if (String(payment.method).toLowerCase() === 'cash') this.financials.myCash += Number(payment.amount || 0);
          else this.financials.myTransfers += Number(payment.amount || 0);
        });
        return;
      }

      if (String(inv.payment_method || '').toLowerCase() === 'cash') this.financials.myCash += Number(inv.total || 0);
      else this.financials.myTransfers += Number(inv.total || 0);
    });
  }

  private buildPaymentSummary(sale: GroupedSale): string {
    const payments = sale.payments || [];
    if (!payments.length) return sale.payment_method.toUpperCase();

    const totals = new Map<string, number>();
    payments.forEach((payment) => {
      const method = String(payment.method || '').toLowerCase();
      totals.set(method, (totals.get(method) || 0) + Number(payment.amount || 0));
    });

    return Array.from(totals.entries())
      .map(([method, amount]) => `${method.toUpperCase()}: ${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
      .join(' | ');
  }

  viewReceipt(invoice: GroupedSale) {
    this.selectedInvoice = invoice;
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.selectedInvoice = null;
  }
}
