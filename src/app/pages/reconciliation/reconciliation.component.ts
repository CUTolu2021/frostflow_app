import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms'; 

@Component({
  selector: 'app-reconciliation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reconciliation.component.html',
  styleUrls: ['./reconciliation.component.css']
})
export class ReconciliationComponent implements OnInit {
  
  mismatches: any[] = [];
  isLoading = true;
  totalMismatches = 0;
  criticalItems = 0;

  constructor(private supabase: SupabaseService) {}

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.isLoading = true;
    this.mismatches = await this.supabase.getPendingMismatches();
    this.totalMismatches = this.mismatches.length;
    this.criticalItems = this.mismatches.filter(m => m.difference > 5).length; 
    
    this.isLoading = false;
    console.log(this.mismatches);
  
  }

  async trustOwner(item: any) {
    if(confirm(`Update inventory to OWNER count (${item.owner_quantity})?`)) {
      await this.processResolution(item, item.owner_quantity, 'Owner count accepted');
    }
  }

  async trustSales(item: any) {
    
    const salesQty = item.sales_quantity || 0;
    if(confirm(`Update inventory to SALES count (${salesQty})? This confirms a loss of ${item.difference}.`)) {
      await this.processResolution(item, salesQty, 'Sales count accepted (Loss confirmed)');
    }
  }

  
  async manualFix(item: any) {
    const finalVal = prompt("Enter the ACTUAL physical count:", item.owner_quantity);
    if (finalVal !== null) {
      await this.processResolution(item, Number(finalVal), 'Manual Admin Override');
    }
  }

  async processResolution(item: any, finalQty: number, note: string) {
    try {
      await this.supabase.resolveMismatch(item, finalQty, note);
      alert('Resolved successfully!');
      this.loadData(); 
    } catch (error) {
      alert('Error resolving item.');
      console.error(error);
    }
  }
}