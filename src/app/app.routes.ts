import { Routes } from '@angular/router'
import { LoginComponent } from './login/login.component'
import { OwnerDashboardComponent } from './pages/owner-dashboard/owner-dashboard.component'
import { SalesDashboardComponent } from './pages/sales-dashboard/sales-dashboard.component'
import { authGuard } from './auth.guard'
import { UserRole } from './enums/role'
import { ReconciliationComponent } from './pages/reconciliation/reconciliation.component'
import { MainLayoutComponent } from './components/main-layout/main-layout.component'

export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' },

    { path: '*', redirectTo: 'login', pathMatch: 'full' },

    { path: 'login', component: LoginComponent, title: 'Login Page' },

    {
        path: 'admin',
        component: MainLayoutComponent,
        canActivate: [authGuard],
        data: { roles: [UserRole.admin] },
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            {
                path: 'dashboard',
                component: OwnerDashboardComponent,
                title: 'Owner Dashboard',
            },
            {
                path: 'products',
                loadComponent: () =>
                    import('./pages/products/products.component').then(
                        (m) => m.ProductsComponent
                    ),
                title: 'Products Catalog',
            },
            {
                path: 'inventory',
                loadComponent: () =>
                    import('./pages/inventory/inventory.component').then(
                        (m) => m.InventoryComponent
                    ),
                title: 'Inventory',
            },
            {
                path: 'staff',
                loadComponent: () =>
                    import('./pages/staff/staff.component').then(
                        (m) => m.StaffComponent
                    ),
                title: 'Staff Management',
            },
            {
                path: 'mismatch',
                loadComponent: () =>
                    import('./pages/reconciliation/reconciliation.component').then(
                        (m) => m.ReconciliationComponent
                    ),
                title: 'Reconciliation',
            },
            {
                path: 'analysis',
                loadComponent: () =>
                    import('./pages/analysis/analysis.component').then(
                        (m) => m.AnalysisComponent
                    ),
                title: 'Analytics',
            },








        ],
    },

    {
        path: 'sales',
        component: MainLayoutComponent,
        canActivate: [authGuard],
        data: { roles: [UserRole.sales] },
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            {
                path: 'dashboard',
                component: SalesDashboardComponent,
                title: 'Sales Dashboard',
            },
            {
                path: 'receive',
                loadComponent: () =>
                    import('./pages/sales-receive/sales-receive.component').then(
                        (m) => m.SalesReceiveComponent
                    ),
                title: 'Receive Stock',
            },
            {
                path: 'lookup',
                loadComponent: () =>
                    import('./pages/products/products.component').then(
                        (m) => m.ProductsComponent
                    ),
                title: 'Product Lookup',
            },
            {
                path: 'history',
                loadComponent: () =>
                    import('./pages/sales-history/sales-history.component').then(
                        (m) => m.SalesHistoryComponent
                    ),
                title: 'Transaction History',
            },
        ],
    },

]
