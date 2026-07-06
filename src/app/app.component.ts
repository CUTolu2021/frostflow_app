import { Component, OnInit, OnDestroy, effect, Injector } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterOutlet, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router'
import { ToastComponent } from './components/toast/toast.component'
import { SupabaseService } from './services/supabase.service'
import { LoadingComponent } from './components/loading/loading.component'
import { LoadingService } from './services/loading.service'
import { AutoLogoutService } from './services/auto-logout.service'
import { DialogComponent } from './components/dialog/dialog.component'
import { ToastService } from './services/toast.service'
import { RouteWarmupService } from './services/route-warmup.service'

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, ToastComponent, LoadingComponent, DialogComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
})
export class AppComponent implements OnInit, OnDestroy {
    title = 'frostflow_app'
    private profileSubscription: { unsubscribe: () => void } | null = null;

    constructor(
        private supabase: SupabaseService,
        private router: Router,
        public loadingService: LoadingService,
        private autoLogout: AutoLogoutService,
        private injector: Injector,
        private toast: ToastService,
        private routeWarmup: RouteWarmupService
    ) {

    }

    async ngOnInit() {

        const routerEvent = toSignal(this.router.events, { injector: this.injector });

        effect(() => {
            const event = routerEvent();
            if (event instanceof NavigationStart) {
                this.loadingService.show();
            } else if (
                event instanceof NavigationEnd ||
                event instanceof NavigationCancel ||
                event instanceof NavigationError
            ) {
                this.loadingService.hide();
            }
        }, { injector: this.injector });



        const user = await this.supabase.validateSession();
        if (user) {
            await this.checkUserStatus();
            this.setupProfileSubscription(user.id);
            this.autoLogout.initListener();
            this.routeWarmup.preloadForRole(localStorage.getItem('user_role'));
        }


        this.supabase.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                await this.checkUserStatus();
                this.setupProfileSubscription(session.user.id);
                this.autoLogout.initListener();
                this.routeWarmup.preloadForRole(localStorage.getItem('user_role'));
            } else if (event === 'SIGNED_OUT') {
                this.cleanupSubscription();
                this.autoLogout.cleanup();
            }
        });
    }

    private async checkUserStatus() {
        const currentUser = await this.supabase.validateSession();
        if (!currentUser || !currentUser.is_active) {
            this.forceLogout();
        }
    }

    private setupProfileSubscription(userId: string) {
        this.cleanupSubscription();
        this.profileSubscription = this.supabase.subscribeToProfileChanges(userId, (payload) => {
            if (payload.new && payload.new.is_active === false) {
                this.forceLogout();
            }
        });
    }

    private forceLogout() {
        this.supabase.signOut().then(() => {
            this.cleanupSubscription();
            this.router.navigate(['/login']);
            this.toast.show('Your account was deactivated. You have been logged out.', 'error');
        });
    }

    private cleanupSubscription() {
        if (this.profileSubscription) {
            this.profileSubscription.unsubscribe();
            this.profileSubscription = null;
        }
    }

    ngOnDestroy() {
        this.cleanupSubscription();
    }
}
