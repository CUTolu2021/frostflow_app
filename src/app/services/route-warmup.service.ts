import { Injectable } from '@angular/core';

type AppRole = 'superadmin' | 'admin' | 'manager' | 'sales';

@Injectable({
    providedIn: 'root',
})
export class RouteWarmupService {
    private warmedRoles = new Set<AppRole>();

    preloadForRole(role: string | null) {
        if (!role || !this.isSupportedRole(role) || this.warmedRoles.has(role)) {
            return;
        }

        this.warmedRoles.add(role);
        const warmup = () => {
            void Promise.allSettled(this.getImportsForRole(role).map((load) => load()));
        };

        const appWindow = window as Window & typeof globalThis & {
            requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
        };

        if (appWindow.requestIdleCallback) {
            appWindow.requestIdleCallback(() => warmup(), { timeout: 1500 });
            return;
        }

        globalThis.setTimeout(warmup, 300);
    }

    private getImportsForRole(role: AppRole) {
        switch (role) {
            case 'superadmin':
                return [
                    () => import('../pages/superadmin-users/superadmin-users.component'),
                ];
            case 'admin':
            case 'manager':
                return [
                    () => import('../pages/products/products.component'),
                    () => import('../pages/inventory/inventory.component'),
                    () => import('../pages/settings/settings.component'),
                    () => import('../pages/analysis/analysis.component'),
                    () => import('../pages/reconciliation/reconciliation.component'),
                    () => import('../pages/staff/staff.component'),
                ];
            case 'sales':
                return [
                    () => import('../pages/sales-receive/sales-receive.component'),
                    () => import('../pages/products/products.component'),
                    () => import('../pages/sales-history/sales-history.component'),
                ];
        }
    }

    private isSupportedRole(role: string): role is AppRole {
        return role === 'superadmin' || role === 'admin' || role === 'manager' || role === 'sales';
    }
}
