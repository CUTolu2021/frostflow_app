import { Routes } from '@angular/router'
import { LoginComponent } from './login/login.component'
import { OwnerDashboardComponent } from './pages/owner-dashboard/owner-dashboard.component'
import { SalesDashboardComponent } from './pages/sales-dashboard/sales-dashboard.component'
import { authGuard } from './auth.guard'
import { UserRole } from './enums/role'
import { ReconciliationComponent } from './pages/reconciliation/reconciliation.component'
import { MainLayoutComponent } from './components/main-layout/main-layout.component'
import { SuperadminDashboardComponent } from './pages/superadmin-dashboard/superadmin-dashboard.component'
import { SuperadminUsersComponent } from './pages/superadmin-users/superadmin-users.component'
import { ForcePasswordComponent } from './pages/force-password/force-password.component'
import { StaffSignupComponent } from './pages/staff-signup/staff-signup.component'

export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' },

    { path: 'login', component: LoginComponent, title: 'Login Page' },
    { path: 'staff-signup', component: StaffSignupComponent, title: 'Staff Signup' },

    {
        path: 'force-password',
        component: ForcePasswordComponent,
        canActivate: [authGuard],
        data: { roles: [UserRole.superadmin, UserRole.admin, UserRole.manager, UserRole.sales] },
        title: 'Change Password',
    },

    {
        path: 'superadmin',
        component: MainLayoutComponent,
        canActivate: [authGuard],
        data: { roles: [UserRole.superadmin] },
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            {
                path: 'dashboard',
                component: SuperadminDashboardComponent,
                title: 'Superadmin Console',
            },
            {
                path: 'users',
                component: SuperadminUsersComponent,
                title: 'Manage Users',
            },
        ],
    },

    {
        path: 'admin',
        component: MainLayoutComponent,
        canActivate: [authGuard],
        data: { roles: [UserRole.admin, UserRole.manager] },
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
                path: 'settings',
                loadComponent: () =>
                    import('./pages/settings/settings.component').then(
                        (m) => m.SettingsComponent
                    ),
                title: 'Settings',
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
            {
                path: 'sales',
                component: SalesDashboardComponent,
                title: 'Sales Entry',
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

    { path: '**', redirectTo: 'login', pathMatch: 'full' },
]
