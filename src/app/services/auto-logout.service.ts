import { Injectable, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';
import { ToastService } from './toast.service';

@Injectable({
    providedIn: 'root'
})
export class AutoLogoutService {
    private logoutTimer?: ReturnType<typeof setTimeout>;
    private readonly INACTIVITY_LIMIT = 5 * 60 * 1000;
    private events = ['mousemove', 'click', 'keypress', 'scroll', 'touchstart'];

    private supabase = inject(SupabaseService);
    private router = inject(Router);
    private toast = inject(ToastService);
    private ngZone = inject(NgZone);


    private eventHandler = () => this.resetTimer();

    constructor() { }

    initListener() {

        this.ngZone.runOutsideAngular(() => {
            this.events.forEach(event => {
                document.addEventListener(event, this.eventHandler);
            });
        });
        this.resetTimer();

    }

    cleanup() {
        this.events.forEach(event => {
            document.removeEventListener(event, this.eventHandler);
        });
        if (this.logoutTimer) {
            clearTimeout(this.logoutTimer);
        }
    }

    private resetTimer() {
        if (this.logoutTimer) {
            clearTimeout(this.logoutTimer);
        }

        this.ngZone.runOutsideAngular(() => {
            this.logoutTimer = setTimeout(() => {

                this.ngZone.run(() => {
                    this.handleLogout();
                });
            }, this.INACTIVITY_LIMIT);
        });
    }

    private async handleLogout() {
        this.cleanup();

        try {
            console.warn('[AutoLogoutService] Inactivity limit reached. Clearing local storage and signing out.');
            localStorage.clear();
            await this.supabase.signOut();
            this.toast.show('Logged out due to inactivity', 'info');
            this.router.navigate(['/login']);
        } catch (error) {
            console.error('Auto-logout error:', error);

            this.router.navigate(['/login']);
        }
    }
}
