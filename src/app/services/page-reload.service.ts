import { Injectable, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingService } from './loading.service';

@Injectable({
    providedIn: 'root'
})
export class PageReloadService {
    private tabHiddenAt: number | null = null;
    private lastReloadAt: number = 0;
    private readonly MIN_TIME_AWAY = 5 * 1000; // 5 seconds (aggressive to catch auth lock)
    private readonly MIN_TIME_BETWEEN_RELOADS = 30 * 1000; // 30 seconds (prevent reload loops)

    private router = inject(Router);
    private loadingService = inject(LoadingService);
    private ngZone = inject(NgZone);

    constructor() {
        this.initVisibilityListener();
    }

    private initVisibilityListener() {
        this.ngZone.runOutsideAngular(() => {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    // User left the tab - record the time
                    this.tabHiddenAt = Date.now();
                } else if (document.visibilityState === 'visible' && this.tabHiddenAt) {
                    // User came back - check conditions
                    const timeAway = Date.now() - this.tabHiddenAt;
                    const timeSinceLastReload = Date.now() - this.lastReloadAt;

                    // Skip if on login page (no session to recover)
                    if (this.router.url === '/login') {
                        this.tabHiddenAt = null;
                        return;
                    }

                    // Reload if:
                    // 1. User was away for at least 5 seconds (enough for auth lock to occur)
                    // 2. It's been at least 30 seconds since last reload (prevent loops)
                    if (timeAway > this.MIN_TIME_AWAY && timeSinceLastReload > this.MIN_TIME_BETWEEN_RELOADS) {
                        console.log(`[PageReload] User was away for ${Math.round(timeAway / 1000)}s. Refreshing to prevent auth lock...`);
                        this.performStrategicReload();
                    }

                    this.tabHiddenAt = null;
                }
            });
        });
    }

    private performStrategicReload() {
        this.ngZone.run(() => {
            this.lastReloadAt = Date.now();

            // Show loading spinner to make reload feel intentional
            this.loadingService.show();

            // Small delay so user sees the loading (feels like app is "waking up")
            setTimeout(() => {
                window.location.reload();
            }, 200);
        });
    }

    // Manual trigger if needed
    triggerReload() {
        this.performStrategicReload();
    }
}
