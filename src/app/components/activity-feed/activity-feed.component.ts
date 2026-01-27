import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';
import { Sale } from '../../interfaces/sales';

interface Activity {
    type: string;
    user: string;
    description: string;
    time: Date;
    amount: number;
}

@Component({
    selector: 'app-activity-feed',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './activity-feed.component.html',
    styleUrls: ['./activity-feed.component.css']
})
export class ActivityFeedComponent implements OnInit {
    recentActivity: Activity[] = [];

    constructor(private supabase: SupabaseService) { }

    async ngOnInit() {
        this.loadData();
    }

    async loadData() {
        const sales: Sale[] = await this.supabase.getRecentSales(); // Returns last 10
        this.recentActivity = sales.map((s) => ({
            type: 'sale',
            user: s.users?.name || 'Staff',
            description: `${s.quantity} ${s.unit_type} of ${s.products?.name}`,
            time: new Date(s.created_at),
            amount: s.total_price
        }));
    }
}
