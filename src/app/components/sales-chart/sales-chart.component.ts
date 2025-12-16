import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';


declare const Chart: any;

@Component({
  selector: 'app-sales-chart',
  standalone: true,
  imports: [CommonModule], 
  templateUrl: './sales-chart.component.html',
  styleUrls: ['./sales-chart.component.css']
})
export class SalesChartComponent implements OnInit {
  @ViewChild('chartCanvas', { static: true }) private chartCanvas!: ElementRef<HTMLCanvasElement>;
  private chartInstance: any = null;

  
  private labels: string[] = [];
  private stockData: number[] = [];
  private soldData: number[] = [];

  constructor(private supabase: SupabaseService) {}
  
  
  
  

  ngOnInit(): void {
    
    this.loadChartData();
  }

  private async loadChartData() {
    try {
      const rawData = await this.supabase.getChartData();
      if (rawData && rawData.length > 0) {
        this.labels = rawData.map((item: any) => item.products?.name || 'Unknown');
        this.stockData = rawData.map((item: any) => Number(item.current_balance || 0));
        this.soldData = rawData.map((item: any) => Number(item.total_sold || 0));
      } else {
        
        this.labels = ['Chicken', 'Beef', 'Fish', 'Rice', 'Vegetables'];
        this.stockData = [120, 80, 60, 200, 150];
        this.soldData = [30, 45, 20, 55, 40];
      }
    } catch (err) {
      console.error('Error loading chart data:', err);
      this.labels = ['Chicken', 'Beef', 'Fish', 'Rice', 'Vegetables'];
      this.stockData = [120, 80, 60, 200, 150];
      this.soldData = [30, 45, 20, 55, 40];
    }

    this.renderChart();
  }

  private renderChart() {
    
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    this.chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.labels,
        datasets: [
          { label: 'Current Stock', data: this.stockData, backgroundColor: '#3b82f6' },
          { label: 'Total Sold', data: this.soldData, backgroundColor: '#10b981' }
        ]
      },
      options: {
        responsive: true,
        scales: {
          x: { stacked: false },
          y: { beginAtZero: true }
        }
      }
    });
  }
}