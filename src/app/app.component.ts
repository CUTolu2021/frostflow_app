import { Component, OnInit, OnDestroy } from '@angular/core'
import { Router, RouterOutlet, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router'
import { ToastComponent } from './components/toast/toast.component'
import { SupabaseService } from './services/supabase.service'
import { LoadingComponent } from './components/loading/loading.component'
import { LoadingService } from './services/loading.service'

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, ToastComponent, LoadingComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
})
export class AppComponent implements OnInit, OnDestroy {
    title = 'frostflow_app'
    private profileSubscription: any;

    constructor(
        private supabase: SupabaseService,
        private router: Router,
        private loadingService: LoadingService
    ) {
        // Router Events for Loading
        this.router.events.subscribe(event => {
            if (event instanceof NavigationStart) {
                this.loadingService.show();
            } else if (
                event instanceof NavigationEnd ||
                event instanceof NavigationCancel ||
                event instanceof NavigationError
            ) {
                this.loadingService.hide();
            }
        });
    }

    async ngOnInit() {
        // 1. Initial Check
        const user = await this.supabase.getCurrentUser();
        if (user) {
            await this.checkUserStatus(user.id);
            this.setupProfileSubscription(user.id);
        }

        // 2. Listen for Auth Changes (Login/Logout)
        this.supabase.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                await this.checkUserStatus(session.user.id);
                this.setupProfileSubscription(session.user.id);
            } else if (event === 'SIGNED_OUT') {
                this.cleanupSubscription();
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
        this.cleanupSubscription(); // Avoid duplicates
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
            // Using alert to ensure they see it if they are in the middle of something
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
}
