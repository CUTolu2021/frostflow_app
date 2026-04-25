import { Component, OnDestroy, OnInit, Injector } from '@angular/core'
import { CommonModule } from '@angular/common'
import { SupabaseService } from '../../services/supabase.service'
import { Router } from '@angular/router'
import { ToastService } from '../../services/toast.service'
import { DashboardMetricsComponent } from '../../components/dashboard-metrics/dashboard-metrics.component'
import { ActivityFeedComponent } from '../../components/activity-feed/activity-feed.component'
import { StockAlertsComponent } from '../../components/stock-alerts/stock-alerts.component'
import { NotificationRecord, PollingPayload } from '../../interfaces/api'

@Component({
    selector: 'app-owner-dashboard',
    standalone: true,
    imports: [CommonModule, DashboardMetricsComponent, ActivityFeedComponent, StockAlertsComponent],
    templateUrl: './owner-dashboard.component.html',
    styleUrls: ['./owner-dashboard.component.css'],
})
export class OwnerDashboardComponent implements OnInit, OnDestroy {
    notifications: NotificationRecord[] = []
    showDropdown = false
    showUnitCostField: boolean = false

    passwordVisible: boolean = false
    public name: string = localStorage.getItem('user_name') || ''
    email: string = localStorage.getItem('user_email') || ''
    id: string = localStorage.getItem('user_id') || ''

    private notificationSubscription: { unsubscribe: () => void } | null = null;

    constructor(
        private supabase: SupabaseService,
        private toast: ToastService,
        private router: Router,
        private injector: Injector,
    ) {
    }

    async ngOnInit() {
        this.notificationSubscription = this.supabase.subscribeToNotifications((payload: PollingPayload<NotificationRecord>) => {
            this.notifications.unshift(payload.new)
            this.loadData();
        })
    }

    ngOnDestroy() {
        if (this.notificationSubscription) {
            this.notificationSubscription.unsubscribe();
        }
    }

    async loadData() {
        this.notifications = await this.supabase.getUnreadNotifications()
    }

    toggleNotifications() {
        this.showDropdown = !this.showDropdown
    }

    async onNotificationClick(notif: NotificationRecord) {
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
