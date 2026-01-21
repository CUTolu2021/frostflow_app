import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';
import { WebhookService } from '../../services/webhook.service';
@Component({
  selector: 'app-receive-stock',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sales-receive.component.html',
  styleUrls: ['./sales-receive.component.css']
})
export class SalesReceiveComponent implements OnInit {

  products: any[] = [];
  recentEntries: any[] = [];
  isLoading = false;

  // Form State
  receiveForm = {
    product: null as any,
    qty: null as number | null,
    unit: 'box', // default
    hasDamages: false,
    damagedQty: null as number | null
  };

  currentUser: any = null;

  constructor(
    private supabase: SupabaseService,
    private toast: ToastService,
    private n8n: WebhookService
  ) { }

  private stockSubscription: any;

  async ngOnInit() {
    this.currentUser = await this.supabase.getCurrentUser();
    this.products = await this.supabase.getProducts();
    this.loadRecentEntries();

    // Real-time: Listen for new INSERTs
    this.stockSubscription = this.supabase.subscribeToStaffStockChanges((payload) => {
      // When a new row is added (by n8n or anyone), reload the list
      // OR manually unshift if we trust the payload (but we want joined data like product Name)
      // Easiest reliable way: just re-fetch the last 5
      this.loadRecentEntries();
    });
  }

  ngOnDestroy() {
    if (this.stockSubscription) {
      this.stockSubscription.unsubscribe();
    }
  }

  onProductSelect() {
    if (!this.receiveForm.product) return;

    // RULE: Variable Weight (e.g. Chicken) must be counted in Boxes
    // if (this.receiveForm.product.is_variable_weight) {
    //   this.receiveForm.unit = 'box';
    // } else {
    //   // Default reset
    //   this.receiveForm.unit = 'box';
    // }

    // Reset quantities to force fresh count
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
      organization_id: 'e01a884e-fd78-4389-9e8c-5509c2565611', // TODO: Dynamic Org ID if multi-tenant
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
      //await this.supabase.addStaffStockEntry(payload)
      this.n8n.sendSalesStock(payload)
      this.toast.show('Stock recorded successfully!', 'success');

      // Reset Form immediately (Optimistic UI) 
      // The list will update automatically via subscription when n8n finishes
      this.receiveForm = { product: null, qty: null, unit: 'box', hasDamages: false, damagedQty: null };

    } catch (error) {
      console.error(error);
      this.toast.show('Failed to save entry. Try again.', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async loadRecentEntries() {
    this.recentEntries = await this.supabase.getRecentStaffEntries();
  }
}
