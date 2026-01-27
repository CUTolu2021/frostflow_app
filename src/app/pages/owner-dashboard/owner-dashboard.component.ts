import { Component, OnDestroy, OnInit, effect, inject, Injector, runInInjectionContext } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { CommonModule } from '@angular/common'
import {
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms'
import { SupabaseService } from '../../services/supabase.service'
import { Router } from '@angular/router'
import { ToastService } from '../../services/toast.service'
import { DashboardMetricsComponent } from '../../components/dashboard-metrics/dashboard-metrics.component'
import { ActivityFeedComponent } from '../../components/activity-feed/activity-feed.component'
import { StockAlertsComponent } from '../../components/stock-alerts/stock-alerts.component'
import { ProductService } from '../../services/product.service'
import { Notification } from '../../interfaces/notification'
import { Product } from '../../interfaces/product'
import { async } from 'rxjs'

@Component({
    selector: 'app-owner-dashboard',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, DashboardMetricsComponent, ActivityFeedComponent, StockAlertsComponent],
    templateUrl: './owner-dashboard.component.html',
    styleUrls: ['./owner-dashboard.component.css'],
})
export class OwnerDashboardComponent implements OnInit, OnDestroy {
    notifications: Notification[] = []
    showDropdown = false
    showUnitCostField: boolean = false

    passwordVisible: boolean = false
    public name: string = localStorage.getItem('user_name') || ''
    email: string = localStorage.getItem('user_email') || ''
    id: string = localStorage.getItem('user_id') || ''

    constructor(
        private supabase: SupabaseService,
        private toast: ToastService,
        private router: Router,
        private injector: Injector,
    ) {
    }

    async ngOnInit() {

        this.supabase.subscribeToNotifications((payload) => {
            this.notifications.unshift(payload.new as Notification)
            this.loadData();
        })
    }

    ngOnDestroy() {

    }

    async loadData() {
        this.notifications = await this.supabase.getUnreadNotifications()
    }

    toggleNotifications() {
        this.showDropdown = !this.showDropdown
    }

    async onNotificationClick(notif: any) {
        await this.supabase.markNotificationAsRead(notif.id)
        this.notifications = this.notifications.filter((n) => n.id !== notif.id)

    }

    handleLogout() {
        localStorage.clear()
        this.supabase.signOut()
        this.toast.show('Logout successful!', 'logout')
        this.router.navigate(['/login'])
    }

}
