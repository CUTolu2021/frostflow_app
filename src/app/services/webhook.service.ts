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
    // We use firstValueFrom to treat the HTTP call like a Promise (async/await)
    // We assume your webhook endpoint is /stock-owner-entry
    return await firstValueFrom(
      this.http.post(`${this.n8nUrl}/stock-owner-entry`, data)
    );
  }

  async sendSalesPerson(data: any) {
    return await firstValueFrom(
      this.http.post(`${this.n8nUrl}/sales-person`, data) 
    );
  }


  // Send Sales Entry (We will use this later)
  async sendSalesEntry(data: any) {
    return await firstValueFrom(
      this.http.post(`${this.n8nUrl}/stock-sales-entry`, data)
    );
  }
}
