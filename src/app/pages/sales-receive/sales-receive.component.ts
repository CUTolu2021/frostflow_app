import { Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';
import { WebhookService } from '../../services/webhook.service';
import { Product } from '../../interfaces/product';
import { StaffStockEntry } from '../../interfaces/stock';
import { RealtimeChannel, User } from '@supabase/supabase-js';
@Component({
  selector: 'app-receive-stock',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sales-receive.component.html',
  styleUrls: ['./sales-receive.component.css']
})
export class SalesReceiveComponent implements OnInit {

  products: Product[] = [];
  recentEntries: StaffStockEntry[] = [];
  isLoading = false;


  receiveForm = {
    product: null as Product | null,
    qty: null as number | null,
    unit: 'box',
    hasDamages: false,
    damagedQty: null as number | null
  };

  currentUser: User | null = null;

  constructor(
    private supabase: SupabaseService,
    private toast: ToastService,
    private n8n: WebhookService
  ) {
    effect(() => {
      this.recentEntries = this.supabase.staffStock();
    });
  }

  private stockSubscription?: RealtimeChannel;

  async ngOnInit() {
    this.currentUser = await this.supabase.getCurrentUser();
    this.products = await this.supabase.getProducts();
    this.loadRecentEntries();



    this.stockSubscription = this.supabase.subscribeToStaffStockChanges();
  }

  ngOnDestroy() {
    if (this.stockSubscription) {
      this.stockSubscription.unsubscribe();
    }
  }

  onProductSelect() {
    if (!this.receiveForm.product) return;










    this.receiveForm.qty = null;
    this.receiveForm.hasDamages = false;
    this.receiveForm.damagedQty = null;
  }

  async submitReceive() {


    if (!this.receiveForm.product || !this.receiveForm.qty || this.receiveForm.qty <= 0) {
      this.toast.show('Please enter a valid quantity.', 'error');
      return;
    }

    this.isLoading = true;

    const payload = {
      organization_id: 'e01a884e-fd78-4389-9e8c-5509c2565611',
      product_id: this.receiveForm.product.id,
      quantity: this.receiveForm.qty,
      unit_type: this.receiveForm.unit,
      recorded_by: this.currentUser?.id,
      metadata: {
        damaged_qty: this.receiveForm.damagedQty || 0,
        notes: 'Received from truck (Mobile Entry)'
      }
    };

    try {

      this.n8n.sendSalesStock(payload)
      this.toast.show('Stock recorded successfully!', 'success');



      this.receiveForm = { product: null, qty: null, unit: 'box', hasDamages: false, damagedQty: null };

    } catch (error) {
      console.error(error);
      this.toast.show('Failed to save entry. Try again.', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async loadRecentEntries() {
    await this.supabase.getRecentStaffEntries();
  }
}
