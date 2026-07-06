import { Injectable, signal, effect } from '@angular/core'
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http'
import { firstValueFrom } from 'rxjs'
import { environment } from '../../environments/environment'
import { UserProfile } from '../interfaces/profile'
import { Product } from '../interfaces/product'
import { LoadingService } from './loading.service'
import { StaffStockEntry, StockEntry, ProductHistoryItem } from '../interfaces/stock'
import { AIStockReport } from '../interfaces/ai-report'
import { DailySales, Sale } from '../interfaces/sales'
import { ReconciliationMismatch } from '../interfaces/reconciliation'
import { AuthUser } from '../interfaces/auth-user'
import { CreateExpensePayload, ExpenseRecord } from '../interfaces/expense'
import {
    AdminUser,
    AuthSessionLike,
    ChartDataPoint,
    CreateOrganizationResponse,
    InventoryLog,
    NotificationRecord,
    OrganizationSettings,
    OrganizationSummary,
    PollingPayload,
    RecentStaffEntry,
    StaffInviteResult,
} from '../interfaces/api'
import { getErrorMessage } from '../utils/error-message'

interface PollingSubscription {
    unsubscribe: () => void;
}

@Injectable({
    providedIn: 'root',
})
export class SupabaseService {
    private readonly apiBase = this.resolveApiBase()
    private authCallbacks = new Set<(event: string, session: AuthSessionLike) => void>()
    staffStock = signal<StaffStockEntry[]>([])
    pendingMismatchCount = signal<number>(0)

    constructor(
        private loadingService: LoadingService,
        private http: HttpClient
    ) {
        effect(() => {
            const currentStock = this.staffStock();
            console.log(`[SupabaseService] staffStock signal updated. Count: ${currentStock.length}`);
        });
    }

    private resolveApiBase(): string {
        const envWithApi = environment as typeof environment & { api_url?: string };
        const configured = String(envWithApi.api_url || '').trim();
        if (configured) return configured;

        // In production deployments, use the same host and rely on reverse proxy /api routing.
        if (typeof window !== 'undefined' && window.location?.origin) {
            return window.location.origin;
        }

        return 'http://localhost:3001';
    }

    private emitAuthStateChange(event: string, user: AuthUser | null) {
        for (const callback of this.authCallbacks) {
            callback(event, user ? { user } : null);
        }
    }

    private getToken() {
        return localStorage.getItem('auth_token');
    }

    private getRefreshToken() {
        return localStorage.getItem('refresh_token');
    }

    private clearAuthStorage() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('session_id');
        localStorage.removeItem('auth_user');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_name');
        localStorage.removeItem('user_email');
        localStorage.removeItem('organization_id');
        localStorage.removeItem('organization_name');
    }

    private persistAuth(token: string, refreshToken: string, sessionId: string, user: AuthUser) {
        localStorage.setItem('auth_token', token);
        localStorage.setItem('refresh_token', refreshToken);
        localStorage.setItem('session_id', sessionId);
        localStorage.setItem('auth_user', JSON.stringify(user));
        localStorage.setItem('user_id', user.id);
        localStorage.setItem('user_role', user.role);
        localStorage.setItem('user_name', user.name || '');
        localStorage.setItem('user_email', user.email || '');
        if (user.organization_id) {
            localStorage.setItem('organization_id', user.organization_id);
        } else {
            localStorage.removeItem('organization_id');
        }
        if (user.organization_name) {
            localStorage.setItem('organization_name', user.organization_name);
        } else {
            localStorage.removeItem('organization_name');
        }
    }

    private getStoredUser(): AuthUser | null {
        const raw = localStorage.getItem('auth_user');
        if (!raw) return null;
        try {
            return JSON.parse(raw) as AuthUser;
        } catch {
            return null;
        }
    }

    private async withTimeout<T>(promise: PromiseLike<T>, ms: number = 10000): Promise<T> {
        const timeout = new Promise<T>((_, reject) => {
            const id = setTimeout(() => {
                clearTimeout(id);
                reject(new Error(`Request timed out after ${ms}ms`));
            }, ms);
        });

        return Promise.race([
            Promise.resolve(promise),
            timeout
        ]);
    }

    async resumeSession() {
        await this.validateSession();
    }

    async getCurrentUser(): Promise<AuthUser | null> {
        return this.getStoredUser();
    }

    onAuthStateChange(callback: (event: string, session: AuthSessionLike) => void) {
        this.authCallbacks.add(callback);
        return {
            data: {
                subscription: {
                    unsubscribe: () => this.authCallbacks.delete(callback),
                },
            },
        };
    }

    private buildAuthHeaders(token: string) {
        return new HttpHeaders({
            Authorization: `Bearer ${token}`,
        });
    }

    private async refreshAccessToken(): Promise<boolean> {
        const refreshToken = this.getRefreshToken();
        if (!refreshToken) return false;

        try {
            const res = await firstValueFrom(
                this.http.post<{ token: string; refreshToken: string; sessionId: string; user: AuthUser }>(
                    `${this.apiBase}/api/auth/refresh`,
                    { refreshToken }
                )
            );

            this.persistAuth(res.token, res.refreshToken, res.sessionId, res.user);
            return true;
        } catch {
            this.clearAuthStorage();
            return false;
        }
    }

    async validateSession(): Promise<AuthUser | null> {
        let token = this.getToken();
        if (!token) {
            this.clearAuthStorage();
            return null;
        }

        try {
            const res = await firstValueFrom(
                this.http.get<{ user: AuthUser }>(`${this.apiBase}/api/auth/me`, {
                    headers: this.buildAuthHeaders(token),
                })
            );

            this.persistAuth(
                token,
                this.getRefreshToken() || '',
                localStorage.getItem('session_id') || '',
                res.user
            );
            return res.user;
        } catch {
            const refreshed = await this.refreshAccessToken();
            if (!refreshed) {
                this.clearAuthStorage();
                return null;
            }
            token = this.getToken();
            if (!token) return null;

            try {
                const res = await firstValueFrom(
                    this.http.get<{ user: AuthUser }>(`${this.apiBase}/api/auth/me`, {
                        headers: this.buildAuthHeaders(token),
                    })
                );
                this.persistAuth(
                    token,
                    this.getRefreshToken() || '',
                    localStorage.getItem('session_id') || '',
                    res.user
                );
                return res.user;
            } catch {
                this.clearAuthStorage();
                return null;
            }
        }
    }

    private async getValidAccessToken(): Promise<string> {
        const token = this.getToken();
        if (token) return token;

        const refreshed = await this.refreshAccessToken();
        if (!refreshed) {
            throw new Error('You are not authenticated');
        }

        const nextToken = this.getToken();
        if (!nextToken) {
            throw new Error('You are not authenticated');
        }

        return nextToken;
    }

    private async requestWithAuth<T>(
        method: 'get' | 'post' | 'patch' | 'delete',
        path: string,
        body?: unknown,
        params?: Record<string, string>
    ): Promise<T> {
        let token = await this.getValidAccessToken();
        const httpParams = params ? new HttpParams({ fromObject: params }) : undefined;

        const makeRequest = async () =>
            firstValueFrom(
                this.http.request<T>(method, `${this.apiBase}${path}`, {
                    body,
                    params: httpParams,
                    headers: this.buildAuthHeaders(token),
                })
            );

        try {
            return await makeRequest();
        } catch (error: unknown) {
            const status = (typeof error === 'object' && error !== null && typeof (error as { status?: unknown }).status === 'number')
                ? (error as { status: number }).status
                : undefined;
            if (status === 401) {
                const refreshed = await this.refreshAccessToken();
                if (refreshed) {
                    token = await this.getValidAccessToken();
                    return await makeRequest();
                }
            }
            throw error;
        }
    }

    private async postWithAuth<T>(path: string, body: unknown): Promise<T> {
        return this.requestWithAuth('post', path, body);
    }

    async signInWithPassword(email: string, password: string) {
        this.loadingService.show();
        try {
            const res = await firstValueFrom(
                this.http.post<{ token: string; refreshToken: string; sessionId: string; user: AuthUser }>(`${this.apiBase}/api/auth/login`, {
                    email,
                    password,
                })
            );

            this.persistAuth(res.token, res.refreshToken, res.sessionId, res.user);
            this.emitAuthStateChange('SIGNED_IN', res.user);

            return {
                data: { session: { user: res.user } },
                error: null,
            };
        } catch (error: unknown) {
            const status = Number(
                typeof error === 'object' && error !== null && typeof (error as { status?: unknown }).status === 'number'
                    ? (error as { status: number }).status
                    : 0
            );
            const message = status === 0
                ? 'Cannot reach server. Please ensure the backend is running and try again.'
                : getErrorMessage(error, 'Login failed');
            return {
                data: { session: null },
                error: { message },
            };
        } finally {
            this.loadingService.hide();
        }
    }

    async signOut() {
        this.loadingService.show();
        const token = this.getToken();
        const refreshToken = this.getRefreshToken();
        try {
            if (token) {
                await firstValueFrom(
                    this.http.post(
                        `${this.apiBase}/api/auth/logout`,
                        { refreshToken },
                        {
                            headers: this.buildAuthHeaders(token),
                        }
                    )
                );
            }
        } catch {
            // Logout is client-authoritative. Ignore API logout failure.
        } finally {
            this.clearAuthStorage();
            this.emitAuthStateChange('SIGNED_OUT', null);
            this.loadingService.hide();
        }
        return { error: null };
    }

    async changeOwnPassword(currentPassword: string, nextPassword: string) {
        const res = await this.requestWithAuth<{ user: AuthUser }>(
            'post',
            '/api/auth/change-password',
            { currentPassword, nextPassword }
        );
        if (res.user) {
            const token = this.getToken() || '';
            this.persistAuth(
                token,
                this.getRefreshToken() || '',
                localStorage.getItem('session_id') || '',
                res.user
            );
        }
        return res.user;
    }

    async getUserProfile(userId: string): Promise<UserProfile | null> {
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                const res = await this.requestWithAuth<{ profile: UserProfile }>('get', `/api/app/users/${userId}`);
                return res.profile || null;
            } catch (err: unknown) {
                attempts++;
                console.warn(`getUserProfile attempt ${attempts} failed:`, getErrorMessage(err));
                if (attempts === maxAttempts) {
                    console.error('Final failure fetching user profile:', err);
                    return null;
                }
                await new Promise(resolve => setTimeout(resolve, attempts * 1000));
            }
        }
        return null;
    }

    async getProducts(options?: { showLoading?: boolean }): Promise<Product[]> {
        const showLoading = options?.showLoading !== false;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                if (showLoading) this.loadingService.show();
                const res = await this.withTimeout(this.requestWithAuth<{ products: Product[] }>('get', '/api/app/products'));
                return res.products || [];
            } catch (err: unknown) {
                attempts++;
                console.warn(`[SupabaseService] getProducts attempt ${attempts} failed:`, getErrorMessage(err));
                if (attempts === maxAttempts) {
                    console.error('[SupabaseService] Final failure fetching products:', err);
                    return [];
                }
                await new Promise(resolve => setTimeout(resolve, attempts * 500));
            } finally {
                if (showLoading) this.loadingService.hide();
            }
        }
        return [];
    }

    async getProduct(productId: string) {
        const res = await this.requestWithAuth<{ product: Product }>('get', `/api/app/products/${productId}`);
        return res.product;
    }

    async addProduct(product: Partial<Product>) {
        this.loadingService.show();
        try {
            const { product: created } = await this.requestWithAuth<{ product: Product }>('post', '/api/app/products', product);
            return created;
        } finally {
            this.loadingService.hide();
        }
    }

    async updateProduct(id: string, updates: Partial<Product>) {
        this.loadingService.show();
        try {
            const { product: updated } = await this.requestWithAuth<{ product: Product }>('patch', `/api/app/products/${id}`, updates);
            return updated;
        } finally {
            this.loadingService.hide();
        }

    }

    async deleteProduct(id: string) {
        this.loadingService.show();
        try {
            await this.requestWithAuth('delete', `/api/app/products/${id}`);
            return true;
        } finally {
            this.loadingService.hide();
        }
    }

    async getAIReports(): Promise<AIStockReport[]> {
        this.loadingService.show();
        try {
            const res = await this.requestWithAuth<{ reports: AIStockReport[] }>('get', '/api/app/ai-reports', undefined, { limit: '1' });
            return res.reports || [];
        } finally {
            this.loadingService.hide();
        }
    }

    async getPendingMismatches(): Promise<ReconciliationMismatch[]> {
        const res = await this.requestWithAuth<{ mismatches: ReconciliationMismatch[] }>('get', '/api/app/reconciliation/pending');
        const mismatches = res.mismatches || [];
        this.pendingMismatchCount.set(mismatches.length);
        return mismatches;
    }

    async refreshPendingMismatchCount(): Promise<number> {
        try {
            const mismatches = await this.getPendingMismatches();
            return mismatches.length;
        } catch {
            this.pendingMismatchCount.set(0);
            return 0;
        }
    }

    async resolveMismatch(
        item: ReconciliationMismatch,
        finalQuantity: number,
        resolutionNote: string
    ) {
        const response = await this.postWithAuth<{ success: boolean }>(
            '/api/inventory/reconciliation/resolve',
            {
                reconciliationId: item.id,
                productId: item.product_id,
                finalQuantity,
                resolutionNote,
            }
        );

        return response.success;
    }

    async runReconciliationNow(windowDate?: string) {
        const response = await this.postWithAuth<{ summary: {
            windowDate: string;
            totalProductsChecked: number;
            mismatchCount: number;
            missingCount: number;
            extraCount: number;
            escalatedCount: number;
        } }>('/api/inventory/reconciliation/run', {
            windowDate: windowDate || undefined,
        });

        return response.summary;
    }

    async getDashboardMetrics() {
        this.loadingService.show();
        try {
            const metrics = await this.requestWithAuth<{ totalValue: number; lowStock: number; totalItems: number; totalExpenses?: number }>(
                'get',
                '/api/app/metrics/dashboard'
            );
            return {
                totalValue: Number(metrics?.totalValue || 0),
                lowStock: Number(metrics?.lowStock || 0),
                totalItems: Number(metrics?.totalItems || 0),
                totalExpenses: Number(metrics?.totalExpenses || 0),
            };
        } finally {
            this.loadingService.hide();
        }
    }

    async getSalesDashboardMetrics() {
        const metrics = await this.requestWithAuth<{ totalSalesValue: number; totalUnitsSold: number }>(
            'get',
            '/api/app/metrics/sales'
        );
        return metrics || { totalSalesValue: 0, totalUnitsSold: 0 };
    }

    async getTodaySalesMetrics() {
        const metrics = await this.requestWithAuth<{ todaySalesValue: number; todayUnitsSold: number }>(
            'get',
            '/api/app/metrics/sales/today'
        );
        return metrics || { todaySalesValue: 0, todayUnitsSold: 0 };
    }

    async getChartData(): Promise<ChartDataPoint[]> {
        const res = await this.requestWithAuth<{ chart: ChartDataPoint[] }>('get', '/api/app/metrics/chart');
        return res.chart || [];
    }

    async getUnreadNotifications(): Promise<NotificationRecord[]> {
        const res = await this.requestWithAuth<{ notifications: NotificationRecord[] }>('get', '/api/app/notifications');
        return res.notifications || [];
    }

    async markNotificationAsRead(id: string | number) {
        await this.requestWithAuth('patch', `/api/app/notifications/${String(id)}/read`, {});
    }

    async getDailyEntryStatus() {
        const res = await this.requestWithAuth<{ ownerReady: boolean; salesReady: boolean }>(
            'get',
            '/api/app/metrics/daily-entry-status'
        );

        return res;
    }

    async getInventoryLogs(): Promise<InventoryLog[]> {
        const res = await this.requestWithAuth<{ logs: InventoryLog[] }>('get', '/api/app/inventory/logs');
        return res.logs || [];
    }

    async getProductHistory(productId: string): Promise<ProductHistoryItem[]> {
        const res = await this.requestWithAuth<{ history: ProductHistoryItem[] }>('get', `/api/app/products/${productId}/history`);
        return res.history || [];
    }

    async addStockEntry(payload: StockEntry) {
        this.loadingService.show();
        try {
            const { record } = await this.postWithAuth<{ record: StockEntry }>('/api/inventory/stock-in', payload);
            return record;
        } finally {
            this.loadingService.hide();
        }
    }

    async createStaffInvite(payload: { email: string; role: string }): Promise<StaffInviteResult> {
        try {
            const res = await this.postWithAuth<{
                invite: StaffInviteResult;
            }>('/api/auth/staff/invite', payload);

            return res.invite;
        } catch (error: unknown) {
            throw new Error(getErrorMessage(error, 'Failed to create staff invite'));
        }
    }

    async previewStaffInvite(token: string) {
        const res = await firstValueFrom(
            this.http.get<{
                invite: {
                    invitedEmail: string;
                    role: string;
                    expiresAt: string;
                };
            }>(`${this.apiBase}/api/auth/staff/invite/preview`, {
                params: { token },
            })
        );
        return res.invite;
    }

    async completeStaffInvite(payload: { token: string; email: string; name: string; password: string }) {
        const res = await firstValueFrom(
            this.http.post<{ user: AuthUser }>(`${this.apiBase}/api/auth/staff/invite/complete`, payload)
        );
        return res.user;
    }

    async listOrganizations(): Promise<OrganizationSummary[]> {
        const res = await this.requestWithAuth<{ organizations: OrganizationSummary[] }>(
            'get',
            '/api/admin/organizations'
        );
        return res.organizations || [];
    }

    async getOrganizationSettings(): Promise<OrganizationSettings> {
        const res = await this.requestWithAuth<{ settings: OrganizationSettings }>(
            'get',
            '/api/app/organization/settings'
        );
        return res.settings;
    }

    async updateOrganizationSettings(payload: { inventory_mode: 'dual_control' | 'single_operator' }): Promise<OrganizationSettings> {
        const res = await this.requestWithAuth<{ settings: OrganizationSettings }>(
            'patch',
            '/api/app/organization/settings',
            payload
        );
        return res.settings;
    }

    async createOrganizationWithOwner(payload: {
        organizationName: string;
        ownerName: string;
        ownerEmail: string;
    }): Promise<CreateOrganizationResponse> {
        const res = await this.requestWithAuth<CreateOrganizationResponse>(
            'post',
            '/api/admin/organizations',
            payload
        );
        return res;
    }

    async listAllUsers(): Promise<AdminUser[]> {
        const res = await this.requestWithAuth<{ users: AdminUser[] }>('get', '/api/admin/users');
        return res.users || [];
    }

    async setUserActive(userId: string, isActive: boolean) {
        const res = await this.requestWithAuth<{ user: AuthUser }>(
            'patch',
            `/api/admin/users/${userId}/active`,
            { is_active: isActive }
        );
        return res.user;
    }

    async resetUserPassword(userId: string) {
        const res = await this.requestWithAuth<{ user: AuthUser; tempPassword?: string }>(
            'post',
            `/api/admin/users/${userId}/reset-password`,
            {}
        );
        return res;
    }

    async setOrganizationActive(orgId: string, isActive: boolean): Promise<OrganizationSummary> {
        const res = await this.requestWithAuth<{ organization: OrganizationSummary }>(
            'patch',
            `/api/admin/organizations/${orgId}/active`,
            { is_active: isActive }
        );
        return res.organization;
    }

    async updateOrganizationInventoryMode(
        orgId: string,
        inventoryMode: 'dual_control' | 'single_operator'
    ): Promise<OrganizationSummary> {
        const res = await this.requestWithAuth<{ organization: OrganizationSummary }>(
            'patch',
            `/api/admin/organizations/${orgId}/inventory-mode`,
            { inventory_mode: inventoryMode }
        );
        return res.organization;
    }

    async deleteOrganization(orgId: string) {
        await this.requestWithAuth('delete', `/api/admin/organizations/${orgId}`);
    }

    async softDeleteOrganization(orgId: string): Promise<OrganizationSummary> {
        const res = await this.requestWithAuth<{ organization: OrganizationSummary }>(
            'post',
            `/api/admin/organizations/${orgId}/soft-delete`,
            {}
        );
        return res.organization;
    }

    async getStaffList(): Promise<UserProfile[]> {
        const res = await this.requestWithAuth<{ staff: UserProfile[] }>('get', '/api/app/users/staff');
        return res.staff || [];
    }

    async updateStaffStatus(userId: string, isActive: boolean) {
        await this.requestWithAuth('patch', `/api/app/users/${userId}/active`, { is_active: isActive });
        return true;
    }

    async resetStaffPassword(userId: string, password: string) {
        const res = await this.requestWithAuth<{ user: AuthUser }>(
            'post',
            `/api/auth/staff/${userId}/password`,
            { password }
        );
        return res.user;
    }

    private createPollingSubscription(poller: () => Promise<void>, intervalMs: number): PollingSubscription {
        let active = true;
        const intervalId = setInterval(async () => {
            if (!active) return;
            try {
                await poller();
            } catch (error) {
                console.warn('[SupabaseService] Polling error:', error);
            }
        }, intervalMs);

        return {
            unsubscribe: () => {
                active = false;
                clearInterval(intervalId);
            },
        };
    }

    subscribeToNotifications(callback: (payload: PollingPayload<NotificationRecord>) => void) {
        let lastIds = new Set<string>();
        const poller = async () => {
            const notifications = await this.getUnreadNotifications();
            const nextIds = new Set(notifications.map((n) => String(n.id)));
            for (const notif of notifications) {
                const id = String(notif.id);
                if (!lastIds.has(id)) {
                    callback({ new: notif });
                }
            }
            lastIds = nextIds;
        };

        poller();
        return this.createPollingSubscription(poller, 15000);
    }

    subscribeToProfileChanges(userId: string, callback: (payload: PollingPayload<UserProfile>) => void) {
        let lastStatus: boolean | null = null;
        const poller = async () => {
            const profile = await this.getUserProfile(userId);
            if (!profile) return;
            if (lastStatus !== null && profile.is_active !== lastStatus) {
                callback({ new: profile });
            }
            lastStatus = profile.is_active ?? true;
        };

        poller();
        return this.createPollingSubscription(poller, 15000);
    }

    async getRecentSales(): Promise<Sale[]> {
        const res = await this.requestWithAuth<{ sales: Sale[] }>('get', '/api/app/sales/recent');
        return res.sales || [];
    }

    async recordDailySale(payload: Partial<DailySales>): Promise<Sale> {
        const { sale } = await this.postWithAuth<{ sale: Sale }>(
            '/api/inventory/sales/record',
            payload
        );
        return sale;
    }

    async addStaffStockEntry(payload: StaffStockEntry) {
        const { record } = await this.postWithAuth<{ record: StaffStockEntry }>(
            '/api/inventory/staff-stock-in',
            payload
        );
        return record
    }

    async getRecentStaffEntries(): Promise<StaffStockEntry[]> {
        const res = await this.requestWithAuth<{ entries: StaffStockEntry[] }>('get', '/api/app/staff-stock/recent');
        const entries = (res.entries || []) as StaffStockEntry[];
        this.staffStock.set(entries);
        return entries;
    }

    subscribeToStaffStockChanges(callback?: (payload: PollingPayload<RecentStaffEntry>) => void) {
        let lastIds = new Set<string>();
        const poller = async () => {
            const entries = await this.getRecentStaffEntries();
            const nextIds = new Set(entries.map((e) => String(e.id)));
            for (const entry of entries) {
                const id = String(entry.id);
                if (!lastIds.has(id) && callback) {
                    callback({ new: entry });
                }
            }
            lastIds = nextIds;
        };

        poller();
        return this.createPollingSubscription(poller, 15000);
    }

    async getSalesHistory(startDate: string, endDate: string): Promise<Sale[]> {
        this.loadingService.show();
        try {
            const res = await this.withTimeout(this.requestWithAuth<{ sales: Sale[] }>(
                'get',
                '/api/app/sales/history',
                undefined,
                { startDate, endDate }
            ));
            return (res.sales || []) as Sale[];
        } finally {
            this.loadingService.hide();
        }
    }

    async voidSale(saleId: string, productId: string, quantityToReturn: number, reason: string) {
        this.loadingService.show();
        try {
            const response = await this.postWithAuth<{ success: boolean }>(
                '/api/inventory/sales/void',
                {
                    saleId,
                    productId,
                    quantityToReturn,
                    reason,
                }
            );

            return response.success;
        } finally {
            this.loadingService.hide();
        }
    }

    async getExpenses(startDate: string, endDate: string): Promise<ExpenseRecord[]> {
        this.loadingService.show();
        try {
            const res = await this.withTimeout(this.requestWithAuth<{ expenses: ExpenseRecord[] }>(
                'get',
                '/api/app/expenses',
                undefined,
                { startDate, endDate }
            ));
            return (res.expenses || []) as ExpenseRecord[];
        } finally {
            this.loadingService.hide();
        }
    }

    async createExpense(payload: CreateExpensePayload): Promise<ExpenseRecord> {
        this.loadingService.show();
        try {
            const res = await this.requestWithAuth<{ expense: ExpenseRecord }>(
                'post',
                '/api/app/expenses',
                payload
            );
            return res.expense;
        } finally {
            this.loadingService.hide();
        }
    }
}
