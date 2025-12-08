import { Routes } from '@angular/router';
import { ProductlistComponent } from './productlist/productlist.component';
import { LoginComponent } from './login/login.component';
import { StockentryComponent } from './stockentry/stockentry.component';
import { AppComponent } from './app.component';
import { OwnerDashboardComponent } from './pages/owner-dashboard/owner-dashboard.component';
import { SalesDashboardComponent } from './pages/sales-dashboard/sales-dashboard.component';
import { authGuard } from './auth.guard';
import { roles } from './enums/role';
import { ReconciliationComponent } from './pages/reconciliation/reconciliation.component';
import { SalesChartComponent } from './components/sales-chart/sales-chart.component';
import { AiInsightCardComponent } from './components/ai-insight-card/ai-insight-card.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  
  { path: '*', redirectTo: 'login', pathMatch: 'full' },

  { path: 'login', component: LoginComponent, title: 'Login Page'},

  { path: 'add-stock', component: StockentryComponent, title: 'Add New Product' },

  {path: 'sales-chart', component: SalesChartComponent, title: 'Sales Chart'},
  {
    path: 'admin',
    component: OwnerDashboardComponent,
    title: 'Owner Dashboard',
    canActivate: [authGuard],
    data: { roles: [roles.admin] } 
  },

  {
    path: 'sales',
    component: SalesDashboardComponent,
    title: 'Sales Dashboard',
    canActivate: [authGuard],
    data: { roles: [roles.sales] } 
  },

  {
    path: 'mismatch',
    component: ReconciliationComponent,
    title: 'Fix Mismatch',
    canActivate: [authGuard],
    data: { roles: [roles.admin] }
  },

  {
    path: 'ai-insights',
    component: AiInsightCardComponent,
    title: 'Insights',
    canActivate: [authGuard],
    data: { roles: [roles.admin] }
  },

];