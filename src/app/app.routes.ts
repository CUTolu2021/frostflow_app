import { Routes } from '@angular/router';
import { ProductlistComponent } from './productlist/productlist.component';
import { LoginComponent } from './login/login.component';
import { StockentryComponent } from './stockentry/stockentry.component';
import { AppComponent } from './app.component';
import { OwnerDashboardComponent } from './pages/owner-dashboard/owner-dashboard.component';
import { SalesDashboardComponent } from './pages/sales-dashboard/sales-dashboard.component';
import { authGuard } from './auth.guard';
import { roles } from './enums/role';

export const routes: Routes = [
  // Redirect default route to login
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  { path: 'login', component: LoginComponent, title: 'Login Page'},

  { path: 'add-stock', component: StockentryComponent, title: 'Add New Product' },

  {
    path: 'admin',
    component: OwnerDashboardComponent,
    title: 'Owner Dashboard',
    canActivate: [authGuard],
    data: { roles: [roles.admin] } // Only users with the 'admin' role can access
  },

  {
    path: 'sales',
    component: SalesDashboardComponent,
    title: 'Sales Dashboard',
    canActivate: [authGuard],
    data: { roles: [roles.sales] } // Only users with the 'sales' role can access
  },

];