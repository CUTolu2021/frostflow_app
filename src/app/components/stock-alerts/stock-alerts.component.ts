import { Component, OnDestroy, OnInit, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductService } from '../../services/product.service';
import { Product } from '../../interfaces/product';

@Component({
    selector: 'app-stock-alerts',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './stock-alerts.component.html',
    styleUrls: ['./stock-alerts.component.css']
})
export class StockAlertsComponent implements OnInit, OnDestroy {
    lowStockItems: Product[] = [];
    private productService = inject(ProductService);

    constructor() {
        effect(() => {
            const products = this.productService.products();
            this.lowStockItems = products.filter(p => (p.unit || 0) < 10);
        });
    }

    async ngOnInit() {
        this.productService.startListening();
        await this.productService.loadProducts();
    }

    ngOnDestroy() {
        this.productService.stopListening();
    }
}
