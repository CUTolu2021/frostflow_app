import { Injectable, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';
import { ToastService } from './toast.service';

@Injectable({
    providedIn: 'root'
})
export class AutoLogoutService {
    private logoutTimer: any;
    private readonly INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 Minutes
    private events = ['mousemove', 'click', 'keypress', 'scroll', 'touchstart'];

    private supabase = inject(SupabaseService);
    private router = inject(Router);
    private toast = inject(ToastService);
    private ngZone = inject(NgZone);

    // Bind the handler to 'this' to allow removal
    private eventHandler = () => this.resetTimer();

    constructor() { }

    initListener() {
        // Run outside Angular to avoid triggering change detection on every mouse move
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
                // Re-enter Angular zone to update UI/Router
                this.ngZone.run(() => {
                    this.handleLogout();
                });
            }, this.INACTIVITY_LIMIT);
        });
    }

    private async handleLogout() {
        this.cleanup(); // Stop listening

        try {
            localStorage.clear
            await this.supabase.signOut();
            this.toast.show('Logged out due to inactivity', 'info');
            this.router.navigate(['/login']);
        } catch (error) {
            console.error('Auto-logout error:', error);
            // Force navigation anyway
            this.router.navigate(['/login']);
        }
    }
}
