import { Component, HostListener, OnInit, OnDestroy, ChangeDetectorRef, ApplicationRef, effect, Injector, NgZone } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterOutlet, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router'
import { ToastComponent } from './components/toast/toast.component'
import { SupabaseService } from './services/supabase.service'
import { LoadingComponent } from './components/loading/loading.component'
import { LoadingService } from './services/loading.service'
import { AutoLogoutService } from './services/auto-logout.service'
import { RealtimeChannel } from '@supabase/supabase-js';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, ToastComponent, LoadingComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
})
export class AppComponent implements OnInit, OnDestroy {
    title = 'frostflow_app'
    private profileSubscription: RealtimeChannel | null = null;

    constructor(
        private supabase: SupabaseService,
        private router: Router,
        public loadingService: LoadingService,
        private autoLogout: AutoLogoutService,
        private cdRef: ChangeDetectorRef,
        private appRef: ApplicationRef,
        private injector: Injector,
        private ngZone: NgZone
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



        const user = await this.supabase.getCurrentUser();
        if (user) {
            await this.checkUserStatus(user.id);
            this.setupProfileSubscription(user.id);
            this.autoLogout.initListener();
        }


        this.supabase.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                await this.checkUserStatus(session.user.id);
                this.setupProfileSubscription(session.user.id);
                this.autoLogout.initListener();
            } else if (event === 'SIGNED_OUT') {
                this.cleanupSubscription();
                this.autoLogout.cleanup();
            }
        });
    }

    private async checkUserStatus(userId: string) {
        const profile = await this.supabase.getUserProfile(userId);
        if (profile && !profile.is_active) {
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

            alert('Your account has been deactivated. You will be logged out.');
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

    private isResuming = false;
    @HostListener('document:visibilitychange', [])
    async onVisibilityChange() {
        if (document.visibilityState === 'visible' && !this.isResuming) {
            this.isResuming = true;


            await new Promise(resolve => setTimeout(resolve, 200));

            this.ngZone.run(() => {
                this.supabase.resumeSession()
                    .catch((err: any) => console.warn('Background session resume skip/fail:', err.message))
                    .finally(() => this.isResuming = false);
            });
        }
    }
}
