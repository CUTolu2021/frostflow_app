import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { User } from '@supabase/supabase-js';
import { Sale, GroupedSale } from '../../interfaces/sales';

@Component({
  selector: 'app-sales-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sales-history.component.html',
  styleUrl: './sales-history.component.css'
})
export class SalesHistoryComponent implements OnInit {
  isLoading = true;
  currentUser: User | null = null;


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
          item_summary: ''
        };
      }
      grouped[id].items.push(row);
      if (row.status !== 'voided' && row.status !== 'rejected') {
        grouped[id].total += row.total_price;
      }
    });

    this.groupedSales = Object.values(grouped).sort((a: GroupedSale, b: GroupedSale) =>
      new Date(b.raw_date).getTime() - new Date(a.raw_date).getTime()
    );

    this.calculateFinancials();
  }

  calculateFinancials() {
    this.financials = { myTotal: 0, myCash: 0, myTransfers: 0 };
    this.groupedSales.forEach(inv => {
      if (inv.status === 'voided' || inv.status === 'rejected') return;

      this.financials.myTotal += inv.total;
      if (inv.payment_method.toLowerCase() === 'cash') this.financials.myCash += inv.total;
      else this.financials.myTransfers += inv.total;
    });
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
