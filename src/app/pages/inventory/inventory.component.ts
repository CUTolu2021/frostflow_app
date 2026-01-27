import { Component, OnInit, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { ProductService } from '../../services/product.service';
import { ToastService } from '../../services/toast.service';
import { Product } from '../../interfaces/product';
import { StockEntry, ProductHistoryItem } from '../../interfaces/stock';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.css'
})
export class InventoryComponent implements OnInit {
  products: Product[] = [];
  product: Product | null = null;


  isSidePanelOpen = false;
  selectedHistoryProduct: Product | null = null;
  productHistory: ProductHistoryItem[] = [];
  isLoadingHistory = false;


  isAddModalOpen = false;


  selectedProduct: Product | null = null;
  entry = {
    inputQty: 0,
    unitType: 'kg',
    manualTotalWeight: 0,
    referenceNote: '',
    unitCost: 0,
    unitPrice: 0,
    boxPrice: 0,
    logisticsFee: 0,
  };

  private productService = inject(ProductService);

  constructor(
    private supabase: SupabaseService,
    private toast: ToastService
  ) {

    effect(() => {
      this.products = this.productService.products();
    });
  }

  async ngOnInit() {
    await this.productService.loadProducts();
  }



  async openHistory(product: Product) {
    this.selectedHistoryProduct = product;
    this.isSidePanelOpen = true;
    this.isLoadingHistory = true;
    this.productHistory = [];

    try {
      this.productHistory = await this.supabase.getProductHistory(product.id);
    } catch (error) {
      console.error(error);
      this.toast.show('Failed to load history', 'error');
    } finally {
      this.isLoadingHistory = false;
    }
  }

  closeHistory() {
    this.isSidePanelOpen = false;
    this.selectedHistoryProduct = null;
    this.productHistory = [];
  }



  openAddModal() {
    this.isAddModalOpen = true;
    this.resetForm();
  }

  closeModal() {
    this.isAddModalOpen = false;
    this.resetForm();
  }

  resetForm() {
    this.selectedProduct = null;
    this.entry = {
      inputQty: 0,
      unitType: 'kg',
      manualTotalWeight: 0,
      referenceNote: '',
      unitCost: 0,
      unitPrice: 0,
      boxPrice: 0,
      logisticsFee: 0,
    };
  }



  onProductSelect() {
    if (!this.selectedProduct) return;
    this.product = this.products.find(p => p.id === this.selectedProduct!.id) || null;
    this.entry.unitType = 'kg';
    this.entry.inputQty = 0;
    this.entry.manualTotalWeight = 0;
  }

  calculateFinalWeight(): number {
    if (!this.selectedProduct) return 0;
    const qty = this.entry.inputQty || 0;

    if (this.entry.unitType === 'kg') return qty;

    if (!this.product) return 0;

    if (this.entry.unitType === 'box') {
      if (this.product.is_variable_weight) {
        return this.entry.manualTotalWeight || 0;
      }
      const standardWeight = this.product.standard_box_weight || 0;
      return qty * standardWeight;
    }
    return 0;
  }

  async submitStock() {
    if (!this.selectedProduct) {
      this.toast.show('Please select a product', 'error');
      return;
    }

    const calculatedWeight = this.calculateFinalWeight();

    if (calculatedWeight <= 0) {
      this.toast.show('Invalid Weight Calculation', 'error');
      return;
    }

    const payload: StockEntry = {
      product_id: this.selectedProduct.id,
      quantity: this.entry.inputQty,
      unit_type: this.entry.unitType,
      total_weight: calculatedWeight,
      reference_note: this.entry.referenceNote,
      recorded_by: localStorage.getItem('user_id') || '',
      unit_cost: this.entry.unitCost,
      unit_price: this.entry.unitPrice,
      box_price: this.entry.boxPrice || undefined,
      total_cost: this.entry.unitCost * this.entry.inputQty,
      logistics_fee: this.entry.logisticsFee,
    };

    try {
      await this.supabase.addStockEntry(payload);
      this.toast.show('Stock Added Successfully!', 'success');
      this.closeModal();
    } catch (error: any) {
      console.error(error);
      this.toast.show(error.message || 'Failed to add stock', 'error');
    }
  }
}
