import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ai-insight-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-insight-card.component.html',
  styleUrls: ['./ai-insight-card.component.css']
})
export class AiInsightCardComponent {
  // This receives the JSON from your Parent Dashboard
  @Input() data: any = {

  "summary": "General business health summary in 2–3 sentences.",

  "low_stock_items": [

    {"product": "Chicken Wings", "current_quantity": 12, "threshold": 20},

    {"product": "Frozen Fish", "current_quantity": 8, "threshold": 20}

  ],

  "mismatch_records": [

    {"product": "Shrimps", "difference": 10, "status": "mismatch"},

    {"product": "Turkey", "difference": 6, "status": "missing_in_sales"}

  ],

  "stock_movement": {

    "total_items_added": 150,

    "total_items_sold": 120,

    "net_change": "+30"

  },

  "recommendations": [

    "Reorder Chicken Wings and Frozen Fish immediately.",

    "Verify reconciliation mismatches for Shrimp and Turkey.",

    "Review supplier pricing — unit cost for some items increased this week."

  ]

}; 

  // Helper to calculate percentage for progress bars
  getStockPercentage(current: number, threshold: number): number {
    // If current is 12 and threshold is 20, return 60%
    return Math.min(100, (current / (threshold * 1.5)) * 100);
  }
}