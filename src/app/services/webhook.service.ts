import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WebhookService {
  private n8nUrl = environment.n8n_webhook; 

  constructor(private http: HttpClient) { }
  

  // Send Owner Stock Entry
  async sendOwnerStock(data: any) {
    
    return await firstValueFrom(
      this.http.post(`${this.n8nUrl}/stock-owner-entry`, data)
    );
  }

  async sendSalesStock(data: any) {
    return await firstValueFrom(
      this.http.post(`${this.n8nUrl}/stock-sales-entry`, data)
    );
  }

  async sendDailySales(data: any) {
    return await firstValueFrom(
      this.http.post(`${this.n8nUrl}/sales-entry`, data)
    );
  }
}
