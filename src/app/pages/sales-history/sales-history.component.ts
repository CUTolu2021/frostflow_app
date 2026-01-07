import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-sales-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sales-history.component.html',
  styleUrl: './sales-history.component.css'
})
export class SalesHistoryComponent implements OnInit {
  isLoading = true;
  currentUser: any = null;

  // Data
  groupedSales: any[] = [];
  financials = {
    myTotal: 0,
    myCash: 0,
    myTransfers: 0
  };

  // Filters
  selectedDate: string = new Date().toISOString().split('T')[0];

  // Modal
  selectedInvoice: any = null;
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

    // Reuse the broad fetch but filter in memory (or add a specific service method if performance is key later)
    // For now, getting all sales for the day and filtering by ID is fine for MVP scale.
    const allSales = await this.supabase.getSalesHistory(start, end);

    // Strict Filter: Only MY sales
    const mySales = allSales.filter((s: any) => s.recorded_by === this.currentUser.id);

    // Grouping Logic (Identical to Analysis)
    const grouped: any = {};
    mySales.forEach((row: any) => {
      const id = row.invoice_id || `UNK-${new Date(row.created_at).getTime()}`;
      if (!grouped[id]) {
        grouped[id] = {
          invoice_id: id,
          time: new Date(row.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          raw_date: row.created_at,
          total: 0,
          payment_method: row.payment_method,
          status: row.status || 'completed',
          items: []
        };
      }
      grouped[id].items.push(row);
      if (row.status !== 'void') {
        grouped[id].total += row.total_price;
      }
    });

    this.groupedSales = Object.values(grouped).sort((a: any, b: any) =>
      new Date(b.raw_date).getTime() - new Date(a.raw_date).getTime()
    );

    this.calculateFinancials();
  }

  calculateFinancials() {
    this.financials = { myTotal: 0, myCash: 0, myTransfers: 0 };
    this.groupedSales.forEach(inv => {
      if (inv.status === 'void') return;

      this.financials.myTotal += inv.total;
      if (inv.payment_method.toLowerCase() === 'cash') this.financials.myCash += inv.total;
      else this.financials.myTransfers += inv.total;
    });
  }

  viewReceipt(invoice: any) {
    this.selectedInvoice = invoice;
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.selectedInvoice = null;
  }
}
