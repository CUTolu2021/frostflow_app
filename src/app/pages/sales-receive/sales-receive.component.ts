import { Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';
import { WebhookService } from '../../services/webhook.service';
import { Product } from '../../interfaces/product';
import { StaffStockEntry } from '../../interfaces/stock';
import { AuthUser } from '../../interfaces/auth-user';
import { ProductService } from '../../services/product.service';
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

  currentUser: AuthUser | null = null;

  constructor(
    private supabase: SupabaseService,
    private toast: ToastService,
    private n8n: WebhookService,
    private productService: ProductService,
  ) {
    effect(() => {
      this.recentEntries = this.supabase.staffStock();
    });

    effect(() => {
      this.products = this.productService.products();
    });
  }

  private stockSubscription?: { unsubscribe: () => void };

  async ngOnInit() {
    this.currentUser = await this.supabase.getCurrentUser();
    this.productService.startListening();
    await this.productService.loadProducts();
    this.loadRecentEntries();



    this.stockSubscription = this.supabase.subscribeToStaffStockChanges();
  }

  ngOnDestroy() {
    this.productService.stopListening();
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

  trackByProductId(_: number, product: Product): string {
    return product.id;
  }

  trackByEntryId(_: number, entry: StaffStockEntry): string {
    return String(entry.id);
  }

  async submitReceive() {
    if (this.isLoading) return;

    if (!this.receiveForm.product || !this.receiveForm.qty || this.receiveForm.qty <= 0) {
      this.toast.show('Please enter a valid quantity.', 'error');
      return;
    }

    this.isLoading = true;

    const payload = {
      product_id: this.receiveForm.product.id,
      quantity: this.receiveForm.qty,
      unit_type: this.receiveForm.unit,
      metadata: {
        damaged_qty: this.receiveForm.damagedQty || 0,
        notes: 'Received from truck (Mobile Entry)'
      }
    };

    try {
      await this.supabase.addStaffStockEntry(payload as StaffStockEntry);
      // Keep n8n as optional side-channel notification, not the source of truth.
      this.n8n.sendSalesStock(payload).catch(() => undefined);
      await this.productService.loadProducts(true, true);
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
