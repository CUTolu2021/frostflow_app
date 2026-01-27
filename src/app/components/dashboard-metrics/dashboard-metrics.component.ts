import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';

@Component({
    selector: 'app-dashboard-metrics',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './dashboard-metrics.component.html',
    styleUrls: ['./dashboard-metrics.component.css']
})
export class DashboardMetricsComponent implements OnInit {
    metrics = {
        totalValue: 0,
        lowStock: 0,
        totalItems: 0,
    };
    salesMetrics = {
        totalSalesValue: 0,
        totalUnitsSold: 0,
    };

    constructor(private supabase: SupabaseService) { }

    async ngOnInit() {
        this.metrics = await this.supabase.getDashboardMetrics();
        this.salesMetrics = await this.supabase.getSalesDashboardMetrics();
    }
}
