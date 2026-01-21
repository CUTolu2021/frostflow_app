import { Injectable, signal, computed, effect, NgZone, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Product } from '../interfaces/product';
import { ToastService } from './toast.service';

@Injectable({
    providedIn: 'root'
})
export class ProductService {
    // State Signals
    products = signal<Product[]>([]);
    loading = signal<boolean>(false);
    error = signal<string | null>(null);

    // Computed signals for derived state
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
        // Optional: Auto-load on service init (or wait for first component)
        this.setupRealtimeSubscription();
    }

    /**
     * Loads products from Supabase.
     * If force = false and data exists, it won't fetch again unless you want strict freshness.
     * But with realtime, we might not need to fetch often.
     */
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
        // Optimistic UI could be tricky with generated IDs, so we'll just wait for the DB return
        // Or we can append pending item. For simplicity & ID safety, we await.
        // However, to make it FEEL fast, we can manage loading state locally or just reliance on Realtime.
        // Let's use standard await but update local signal immediately on success to avoid waiting for realtime event roundtrip.

        try {
            const newProduct = await this.supabase.addProduct(product);

            // Update local state immediately (Realtime might duplicate this, so we handle dedup or trust realtime?
            // Best practice: Update local state. Supabase realtime 'INSERT' event will verify it. 
            // We will check for duplicates in the realtime handler.)
            this.products.update(current => [...current, newProduct]);
            return newProduct;
        } catch (err: any) {
            throw err;
        }
    }

    async updateProduct(id: string, updates: Partial<Product>) {
        // Optimistic update
        const previousProducts = this.products();
        this.products.update(current =>
            current.map(p => p.id === id ? { ...p, ...updates } as Product : p)
        );

        try {
            const updated = await this.supabase.updateProduct(id, updates);
            // Ensure we have the authoritative version
            this.products.update(current =>
                current.map(p => p.id === id ? updated : p)
            );
            return updated;
        } catch (err: any) {
            // Revert on failure
            this.products.set(previousProducts);
            throw err;
        }
    }

    async deleteProduct(id: string) {
        // Optimistic delete
        const previousProducts = this.products();
        this.products.update(current => current.filter(p => p.id !== id));

        try {
            await this.supabase.deleteProduct(id);
        } catch (err: any) {
            // Revert
            this.products.set(previousProducts);
            throw err;
        }
    }

    private setupRealtimeSubscription() {
        this.supabase.subscribeToProductChanges((payload) => {
            // Run in zone to update UI
            this.ngZone.run(() => {
                this.handleRealtimeEvent(payload);
            });
        });
    }

    private handleRealtimeEvent(payload: any) {
        const { eventType, new: newRecord, old: oldRecord } = payload;

        switch (eventType) {
            case 'INSERT':
                this.products.update(current => {
                    // Avoid duplicates if we already added it manually
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
