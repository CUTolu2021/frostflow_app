import { Component, Input, OnInit, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { Product } from '../../interfaces/product';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css'
})
export class ProductsComponent implements OnInit {
  @Input() viewMode: 'admin' | 'lookup' = 'admin';


  products: Product[] = [];
  filteredProducts: Product[] = [];
  searchTerm: string = '';


  totalProducts = 0;
  lowStock = 0;
  outOfStock = 0;
  categoriesCount = 0;


  showModal = false;
  isEditing = false;
  productForm: FormGroup;


  loading = true;
  isSubmitting = false;

  private productService = inject(ProductService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);

  constructor() {
    this.productForm = this.fb.group({
      id: [''],
      name: ['', Validators.required],
      category: [''],
      unit_price: [0, [Validators.required, Validators.min(0)]],
      box_price: [0, [Validators.min(0)]],
      image_url: [''],
      base_unit: ['kg', Validators.required],
      is_box_sold: [false],
      is_variable_weight: [false],
      standard_box_weight: [null, Validators.min(0)],
    });

    const isBoxSoldSignal = toSignal(this.productForm.get('is_box_sold')!.valueChanges, {
      initialValue: this.productForm.get('is_box_sold')?.value
    });

    effect(() => {
      if (!isBoxSoldSignal()) {
        this.productForm.patchValue({
          is_variable_weight: false,
          standard_box_weight: null
        }, { emitEvent: false });
      }
    });


    effect(() => {

      this.products = this.productService.products();


      this.loading = this.productService.loading();


      this.filterProducts();
      this.calculateStats();
    });
  }

  async ngOnInit() {

    await this.productService.loadProducts();

    const role = localStorage.getItem('user_role');
    if (role === 'sales') {
      this.viewMode = 'lookup';
    }
  }

  calculateStats() {
    this.totalProducts = this.products.length;
    this.lowStock = this.products.filter(p => (p.unit ?? 0) < 10 && (p.unit ?? 0) > 0).length;
    this.outOfStock = this.products.filter(p => (p.unit ?? 0) === 0).length;
    this.categoriesCount = new Set(this.products.map(p => p.category)).size;
  }

  filterProducts() {
    if (!this.searchTerm) {
      this.filteredProducts = this.products;
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredProducts = this.products.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.category?.toLowerCase().includes(term)
      );
    }
  }

  onSearch(event: any) {
    this.searchTerm = event.target.value;
    this.filterProducts();
  }

  openAddModal() {
    this.isEditing = false;
    this.productForm.enable();
    this.productForm.reset({
      base_unit: 'kg',
      unit_price: 0,
      box_price: 0,
      is_box_sold: false,
      is_variable_weight: false
    });
    this.showModal = true;
  }

  openEditModal(product: Product) {
    this.isEditing = true;
    this.productForm.enable();

    const isBoxSold = product.is_variable_weight || (product.standard_box_weight !== null && product.standard_box_weight !== undefined);

    this.productForm.patchValue({
      id: product.id,
      name: product.name,
      category: product.category,
      unit_price: product.unit_price,
      box_price: product.box_price || 0,
      image_url: product.image_url,
      base_unit: product.base_unit,
      is_box_sold: isBoxSold,
      is_variable_weight: product.is_variable_weight,
      standard_box_weight: product.standard_box_weight
    });

    if (this.viewMode === 'lookup') {
      Object.keys(this.productForm.controls).forEach(key => {
        if (key !== 'unit_price' && key !== 'box_price') {
          this.productForm.get(key)?.disable();
        }
      });
    }

    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  async saveProduct() {
    if (this.productForm.invalid) {
      const errors = this.getFormErrors();
      const invalidFields = Object.keys(errors).join(', ');
      this.toast.show(`Please fill all required fields: ${invalidFields}`, 'error');
      return;
    }

    this.isSubmitting = true;
    const formValue = this.productForm.getRawValue();

    const payload: Partial<Product> = {
      name: formValue.name,
      category: formValue.category || undefined,
      unit_price: formValue.unit_price,
      box_price: formValue.box_price || undefined,
      base_unit: formValue.base_unit,
      image_url: formValue.image_url || undefined,
      created_by: localStorage.getItem('user_id') || "",
      is_variable_weight: formValue.is_box_sold ? formValue.is_variable_weight : false,
      standard_box_weight: (formValue.is_box_sold && !formValue.is_variable_weight) ? formValue.standard_box_weight : null,
      is_active: true
    };

    try {
      if (this.isEditing && formValue.id) {
        await this.productService.updateProduct(formValue.id, payload);
        this.toast.show('Product updated successfully', 'success');
      } else {
        await this.productService.addProduct(payload);
        this.toast.show('Product added successfully', 'success');
      }
      this.closeModal();

    } catch (error: any) {
      console.error('Save failed', error);
      this.toast.show('Error saving product: ' + error.message, 'error');
    } finally {
      this.isSubmitting = false;
    }
  }

  private getFormErrors() {
    const errors: any = {};
    Object.keys(this.productForm.controls).forEach(key => {
      const controlErrors = this.productForm.get(key)?.errors;
      if (controlErrors) {
        errors[key] = controlErrors;
      }
    });
    return errors;
  }

  async deleteProduct(id: string) {
    if (confirm('Are you sure you want to delete this product?')) {
      this.isSubmitting = true;
      try {
        await this.productService.deleteProduct(id);
        this.toast.show('Product deleted successfully', 'success');
      } catch (error: any) {
        this.toast.show('Delete failed: ' + error.message, 'error');
      } finally {
        this.isSubmitting = false;
      }
    }
  }
}
