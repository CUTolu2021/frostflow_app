import { Injectable, signal, computed, effect, NgZone, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Product } from '../interfaces/product';
import { ToastService } from './toast.service';
import { PostgresChangePayload } from '../interfaces/profile';

@Injectable({
    providedIn: 'root'
})
export class ProductService {
    products = signal<Product[]>([]);
    loading = signal<boolean>(false);
    error = signal<string | null>(null);

    totalProducts = computed(() => this.products().length);
    lowStockCount = computed(() => this.products().filter(p => (p.unit ?? 0) < 10 && (p.unit ?? 0) > 0).length);
    outOfStockCount = computed(() => this.products().filter(p => (p.unit ?? 0) === 0).length);
    categoriesCount = computed(() => new Set(this.products().map(p => p.category)).size);

    private initialized = false;
    private ngZone = inject(NgZone);

    constructor(
        private supabase: SupabaseService,
        private toast: ToastService
    ) {
        this.setupRealtimeSubscription();


        effect(() => {
            const currentProducts = this.products();
            console.log(`[ProductService] Products signal updated. Count: ${currentProducts.length}`);
            if (currentProducts.length === 0 && this.initialized) {
                console.warn('[ProductService] Warning: Products signal was cleared (set to empty array) while initialized.');
            }
        });
    }

    async loadProducts(force = false) {
        if ((this.initialized && !force) || this.loading()) return;

        this.loading.set(true);
        try {
            const data = await this.supabase.getProducts();
            this.products.set(data);
            this.initialized = true;
        } catch (err: any) {
            this.error.set(err.message);
            this.toast.show('Failed to load products', 'error');
        } finally {
            this.loading.set(false);
        }
    }

    async addProduct(product: Partial<Product>) {
        try {
            const newProduct = await this.supabase.addProduct(product);
            this.products.update(current => [...current, newProduct]);
            return newProduct;
        } catch (err: any) {
            throw err;
        }
    }

    async updateProduct(id: string, updates: Partial<Product>) {
        const previousProducts = this.products();
        this.products.update(current =>
            current.map(p => p.id === id ? { ...p, ...updates } as Product : p)
        );

        try {
            const updated = await this.supabase.updateProduct(id, updates);
            this.products.update(current =>
                current.map(p => p.id === id ? updated : p)
            );
            return updated;
        } catch (err: any) {
            this.products.set(previousProducts);
            throw err;
        }
    }

    async deleteProduct(id: string) {
        const previousProducts = this.products();
        this.products.update(current => current.filter(p => p.id !== id));

        try {
            await this.supabase.deleteProduct(id);
        } catch (err: any) {
            this.products.set(previousProducts);
            throw err;
        }
    }

    private setupRealtimeSubscription() {
        this.supabase.subscribeToProductChanges((payload) => {

            this.ngZone.run(() => {
                this.handleRealtimeEvent(payload);
            });
        });
    }

    private handleRealtimeEvent(payload: PostgresChangePayload<Product>) {
        const { eventType, new: newRecord, old: oldRecord } = payload;

        switch (eventType) {
            case 'INSERT':
                this.products.update(current => {

                    if (current.some(p => p.id === newRecord.id)) return current;
                    return [...current, newRecord];
                });
                break;

            case 'UPDATE':
                this.products.update(current =>
                    current.map(p => p.id === newRecord.id ? newRecord : p)
                );
                break;

            case 'DELETE':
                this.products.update(current =>
                    current.filter(p => p.id !== oldRecord.id)
                );
                break;
        }
    }
}
