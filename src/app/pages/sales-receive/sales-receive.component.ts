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
    productId: null as string | null,
    qty: null as number | null,
    unit: '',
    hasDamages: false,
    damagedQty: null as number | null,
    measuredTotalWeight: null as number | null,
    measuredBoxWeightsText: '',
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
    await this.loadRecentEntries();

    this.stockSubscription = this.supabase.subscribeToStaffStockChanges();
  }

  ngOnDestroy() {
    this.productService.stopListening();
    if (this.stockSubscription) {
      this.stockSubscription.unsubscribe();
    }
  }

  get selectedProduct(): Product | null {
    if (!this.receiveForm.productId) return null;
    return this.products.find((p) => p.id === this.receiveForm.productId) || null;
  }

  private normalizeUnit(unit: string | null | undefined): string {
    return String(unit || 'kg').trim().toLowerCase();
  }

  private getBaseUnit(product: Product | null): string {
    return this.normalizeUnit(product?.base_unit || 'kg');
  }

  private supportsBoxUnit(product: Product | null): boolean {
    if (!product) return false;
    return Boolean(
      product.is_variable_weight
      || Number(product.standard_box_weight || 0) > 0
      || Number(product.box_price || 0) > 0
      || this.getBaseUnit(product) === 'box'
    );
  }

  getReceiveUnitOptions(): string[] {
    const product = this.selectedProduct;
    if (!product) return [];
    const base = this.getBaseUnit(product);
    const options = [base];
    if (this.supportsBoxUnit(product) && base !== 'box') {
      options.push('box');
    }
    return options;
  }

  getUnitDisplay(unit: string | null | undefined): string {
    const normalized = this.normalizeUnit(unit);
    if (normalized === 'kg') return 'KG';
    if (normalized === 'pcs') return 'Pieces';
    if (normalized === 'liters') return 'Liters';
    if (normalized === 'box') return 'Box / Carton';
    return normalized || 'Unit';
  }

  onProductSelect() {
    if (!this.selectedProduct) return;
    this.receiveForm.unit = this.getReceiveUnitOptions()[0] || this.getBaseUnit(this.selectedProduct);
    this.receiveForm.qty = null;
    this.receiveForm.hasDamages = false;
    this.receiveForm.damagedQty = null;
    this.receiveForm.measuredTotalWeight = null;
    this.receiveForm.measuredBoxWeightsText = '';
  }

  trackByProductId(_: number, product: Product): string {
    return product.id;
  }

  trackByEntryId(_: number, entry: StaffStockEntry): string {
    return String(entry.id);
  }

  requiresMeasuredBoxWeight(): boolean {
    return Boolean(
      this.selectedProduct
      && this.receiveForm.unit === 'box'
      && this.getBaseUnit(this.selectedProduct) !== 'box'
    );
  }

  getMeasuredWeightLabel(): string {
    return this.getUnitDisplay(this.selectedProduct?.base_unit);
  }

  private parseMeasuredBoxWeights(raw: string): number[] {
    const values = String(raw || '')
      .split(/[,\s]+/)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);

    return values;
  }

  private resolveMeasuredTotalWeight(): { totalWeight: number; boxWeights: number[] } {
    const manualTotal = Number(this.receiveForm.measuredTotalWeight || 0);
    const boxWeights = this.parseMeasuredBoxWeights(this.receiveForm.measuredBoxWeightsText);
    const summedBoxes = boxWeights.reduce((sum, value) => sum + value, 0);

    return {
      totalWeight: manualTotal > 0 ? manualTotal : summedBoxes,
      boxWeights,
    };
  }

  async submitReceive() {
    if (this.isLoading) return;

    if (!this.selectedProduct || !this.receiveForm.qty || this.receiveForm.qty <= 0) {
      this.toast.show('Please enter a valid quantity.', 'error');
      return;
    }

    if (!this.receiveForm.unit) {
      this.toast.show('Please select a unit.', 'error');
      return;
    }

    const { totalWeight, boxWeights } = this.resolveMeasuredTotalWeight();
    if (this.requiresMeasuredBoxWeight() && totalWeight <= 0) {
      this.toast.show(`Enter measured total ${this.getMeasuredWeightLabel()} for this box delivery.`, 'error');
      return;
    }

    this.isLoading = true;

    const payload = {
      product_id: this.selectedProduct.id,
      quantity: this.receiveForm.qty,
      unit_type: this.receiveForm.unit,
      metadata: {
        damaged_qty: this.receiveForm.damagedQty || 0,
        notes: 'Received from truck (Mobile Entry)',
        total_weight: totalWeight > 0 ? totalWeight : undefined,
        measured_box_weights: boxWeights.length > 0 ? boxWeights : undefined,
      }
    };

    try {
      await this.supabase.addStaffStockEntry(payload as StaffStockEntry);
      this.n8n.sendSalesStock(payload).catch(() => undefined);
      await this.productService.loadProducts(true, true);
      this.toast.show('Stock recorded successfully!', 'success');

      this.receiveForm = {
        productId: null,
        qty: null,
        unit: '',
        hasDamages: false,
        damagedQty: null,
        measuredTotalWeight: null,
        measuredBoxWeightsText: '',
      };
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
