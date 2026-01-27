import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';
import { Product } from '../../interfaces/product';
import { RealtimeChannel } from '@supabase/supabase-js';

@Component({
    selector: 'app-stock-alerts',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './stock-alerts.component.html',
    styleUrls: ['./stock-alerts.component.css']
})
export class StockAlertsComponent implements OnInit, OnDestroy {
    lowStockItems: Product[] = [];
    products: Product[] = [];
    private productSubscription?: RealtimeChannel;

    constructor(private supabase: SupabaseService) { }

    async ngOnInit() {
        this.loadProducts();

        this.productSubscription = this.supabase.subscribeToProductChanges(() => {
            this.loadProducts();
        });
    }

    loadProducts() {
        this.supabase.getProducts().then(data => {
            this.products = data;
            this.lowStockItems = this.products.filter(p => (p.unit || 0) < 10);
        });
    }

    ngOnDestroy() {
        if (this.productSubscription) this.productSubscription.unsubscribe();
    }
}
