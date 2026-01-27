import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { firstValueFrom } from 'rxjs'
import { environment } from '../../environments/environment'
import { DailySales } from '../interfaces/sales'
import { StockEntry, StaffStockEntry } from '../interfaces/stock'

@Injectable({
    providedIn: 'root',
})
export class WebhookService {
    private n8nUrl = environment.n8n_webhook

    constructor(private http: HttpClient) { }

    // Send Owner Stock Entry
    // async sendOwnerStock(data: Partial<StockEntry>) {
    //     return await firstValueFrom(
    //         this.http.post(`${this.n8nUrl}/stock-owner-entry`, data)
    //     )
    // }

    async sendSalesStock(data: Partial<StaffStockEntry> | any) {
        return await firstValueFrom(
            this.http.post(`${this.n8nUrl}/stock-sales-entry`, data)
        )
    }

    async sendDailySales(data: Partial<DailySales>) {
        return await firstValueFrom(
            this.http.post(`${this.n8nUrl}/sales-entry`, data)
        )
    }

    // async triggerManualReconcile() {
    //   return await
    //     this.http.get(`${this.n8nUrl}/trigger-reconcile`)

    // }
}
