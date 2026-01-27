import { Injectable, signal, WritableSignal, effect } from '@angular/core'
import { createClient, SupabaseClient, User } from '@supabase/supabase-js'
import { environment } from '../../environments/environment'
import { UserProfile, PostgresChangePayload } from '../interfaces/profile'
import { Product } from '../interfaces/product'
import { LoadingService } from './loading.service'
import { StaffStockEntry, StockEntry, ProductHistoryItem } from '../interfaces/stock'
import { AIStockReport } from '../interfaces/ai-report'
import { Sale } from '../interfaces/sales'
import { ReconciliationMismatch } from '../interfaces/reconciliation'

@Injectable({
    providedIn: 'root',
})
export class SupabaseService {
    private supabase: SupabaseClient
    staffStock = signal<StaffStockEntry[]>([])

    constructor(private loadingService: LoadingService) {
        this.supabase = createClient(
            environment.supabase_URL,
            environment.supabase_anon_key,
            {
                auth: {
                    autoRefreshToken: true,
                    persistSession: true,
                    detectSessionInUrl: true
                },
                realtime: {
                    params: {
                        eventsPerSecond: 10,
                    },
                },
            }
        )


        effect(() => {
            const currentStock = this.staffStock();
            console.log(`[SupabaseService] staffStock signal updated. Count: ${currentStock.length}`);
        });
    }

    private async withTimeout<T>(promise: PromiseLike<T>, ms: number = 10000): Promise<any> {
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
        try {

            const { data, error } = await this.supabase.auth.getSession();

            if (error || !data.session) {
                console.log('[SupabaseService] Session invalid/missing on resume, attempting refresh...');
                const { error: refreshError } = await this.supabase.auth.refreshSession();
                if (refreshError) throw refreshError;
            } else {
                console.log('[SupabaseService] Session valid on resume');
            }
        } catch (error: any) {

            if (error?.message?.includes('NavigatorLock') || error?.message?.includes('lock')) {
                console.warn('[SupabaseService] Lock contention detected on resume, skipping manual refresh as internal Supabase logic is likely already handling it.');
            } else {
                console.error('[SupabaseService] Unexpected error in resumeSession:', error);
            }
        }
    }

    get client() {
        return this.supabase;
    }
    async getCurrentUser(): Promise<User | null> {
        try {
            const { data } = await this.supabase.auth.getUser()
            return data.user
        } catch (error: any) {
            if (error?.message?.includes('NavigatorLock') || error?.message?.includes('lock')) {
                console.warn('[SupabaseService] Lock error in getCurrentUser, retrying in 200ms...');
                await new Promise(resolve => setTimeout(resolve, 200));
                const { data } = await this.supabase.auth.getUser();
                return data.user;
            }
            throw error;
        }
    }

    onAuthStateChange(callback: (event: string, session: any) => void) {
        return this.supabase.auth.onAuthStateChange(callback)
    }

    async signInWithPassword(email: string, password: string) {
        this.loadingService.show();
        const res = await this.supabase.auth.signInWithPassword({
            email,
            password,
        })
        this.loadingService.hide();
        return res;
    }

    // async signUpWithPassword(email: string, password: string, options?: any) {
    //     this.loadingService.show();
    //     const res = await this.supabase.auth.signUp({
    //         email,
    //         password,
    //         options,
    //     })
    //     this.loadingService.hide();
    //     return res;
    // }

    // async adminSignUp(email: string, password: string, options?: any) {
    //     return await this.supabase.auth.signInWithPassword({
    //         email,
    //         password,
    //         options,
    //     })
    // }

    async signOut() {
        this.loadingService.show();
        const res = await this.supabase.auth.signOut();
        this.loadingService.hide();
        return res;
    }

    async getUserProfile(userId: string): Promise<UserProfile | null> {
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                const { data, error } = await this.supabase
                    .schema('frostflow_data')
                    .from('users')
                    .select('*')
                    .eq('id', userId)
                    .single()

                if (error) throw error;
                return data as UserProfile | null;

            } catch (err: any) {
                attempts++;
                console.warn(`getUserProfile attempt ${attempts} failed:`, err.message || err);



                if (attempts === maxAttempts) {
                    console.error('Final failure fetching user profile:', err);
                    return null;
                }

                await new Promise(resolve => setTimeout(resolve, attempts * 1000));
            }
        }
        return null;
    }

    async getProducts(): Promise<Product[]> {
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                this.loadingService.show();
                const { data, error } = await this.withTimeout(this.supabase
                    .schema('frostflow_data')
                    .from('products')
                    .select('*')
                    .eq('is_active', true)
                    .order('name', { ascending: true }));

                if (error) throw error;
                return data || [];
            } catch (err: any) {
                attempts++;
                console.warn(`[SupabaseService] getProducts attempt ${attempts} failed:`, err.message || err);
                if (attempts === maxAttempts) {
                    console.error('[SupabaseService] Final failure fetching products:', err);
                    return [];
                }
                await new Promise(resolve => setTimeout(resolve, attempts * 500));
            } finally {
                this.loadingService.hide();
            }
        }
        return [];
    }

    async getProduct(productId: string) {
        const { data, error } = await this.supabase
            .schema('frostflow_data')
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

        if (error) throw error;
        return data;
    }

    async addProduct(product: Partial<Product>) {
        this.loadingService.show();

        const { data, error } = await this.supabase
            .schema('frostflow_data')
            .from('products')
            .insert(product)
            .select()
            .single()

        this.loadingService.hide();
        if (error) throw error
        return data
    }

    async updateProduct(id: string, updates: Partial<Product>) {
        this.loadingService.show();
        const beforeData = await this.getProduct(id)
        const { data, error } = await this.supabase
            .schema('frostflow_data')
            .from('products')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            this.loadingService.hide();
            throw error;
        }
        await this.createAuditLog(
            'products',
            id,
            `Edited Product: ${beforeData.name}`,
            beforeData,
            data
        )
        this.loadingService.hide();
        return data

    }

    async deleteProduct(id: string) {
        this.loadingService.show();
        const beforeData = await this.getProduct(id)

        const { data, error } = await this.supabase
            .schema('frostflow_data')
            .from('products')
            .update({ is_active: false })
            .eq('id', id)
            .select()
            .single()

        if (error) {
            this.loadingService.hide();
            throw error;
        }

        await this.createAuditLog(
            'products',
            id,
            `Archived Product: ${beforeData.name}`,
            beforeData,
            data
        )
        this.loadingService.hide();
        return true
    }

    async getAIReports(): Promise<AIStockReport[]> {
        this.loadingService.show();
        const { data, error } = await this.supabase
            .schema('frostflow_data')
            .from('ai_stock_reports')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
        this.loadingService.hide();
        if (error) {
            console.error('Error fetching AI reports:', error)
            return []
        }
        return (data || []) as AIStockReport[]
    }

    private async createAuditLog(
        tableName: string,
        recordId: string,
        action: string,
        beforeData: any,
        afterData: any
    ) {


        const { error } = await this.supabase
            .schema('frostflow_data')
            .from('audit_logs')
            .insert({
                table_name: tableName,
                record_id: recordId,
                action: action,
                changed_by: localStorage.getItem('user_id'),
                before_data: JSON.stringify(beforeData),
                after_data: JSON.stringify(afterData),
            })

        if (error) console.error('Audit Log Failed:', error)
    }

    async getPendingMismatches(): Promise<ReconciliationMismatch[]> {
        const { data, error } = await this.supabase
            .schema('frostflow_data')
            .from('reconciliation')

            .select('*, products!product_id(name, unit)')
            .neq('status', 'match')
            .neq('status', 'resolved')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching mismatches:', error)
            return []
        }
        return (data || []) as ReconciliationMismatch[]
    }

    async resolveMismatch(
        item: ReconciliationMismatch,
        finalQuantity: number,
        resolutionNote: string
    ) {
        if (!item.products) {
            throw new Error('Product details missing for this mismatch');
        }

        const { error: invError } = await this.supabase
            .schema('frostflow_data')
            .from('products')
            .update({ unit: (item.products.unit || 0) + finalQuantity })
            .eq('id', item.product_id)

        if (invError) throw invError

        await this.createAuditLog(
            'reconciliation',
            item.id,
            `RESOLVED_MISMATCH: ${resolutionNote}`,
            {
                Product: item.products.name,
                Quantity: item.products.unit || 0,
            },
            {
                Product: item.products.name,
                Quantity: (item.products.unit || 0) + finalQuantity,
            }
        )
        const { error: logError } = await this.supabase
            .schema('frostflow_data')
            .from('reconciliation')
            .update({
                status: 'resolved',
            })
            .eq('id', item.id)

        if (logError) throw logError
        return true
    }

    async getDashboardMetrics() {
        this.loadingService.show();
        const { data: products, error } = await this.supabase
            .schema('frostflow_data')
            .from('products')
            .select('unit, unit_price')
            .eq('is_active', true)

        this.loadingService.hide();
        if (error || !products)
            return { totalValue: 0, lowStock: 0, totalItems: 0 }
        const totalValue = products.reduce((sum, item) => {
            return sum + item.unit * item.unit_price
        }, 0)

        const lowStock = products.filter((item) => item.unit < 10).length
        const totalItems = products.length

        return {
            totalValue,
            lowStock,
            totalItems,
        }
    }

    async getSalesDashboardMetrics() {
        const { data: sales, error } = await this.supabase
            .schema('frostflow_data')
            .from('sales')
            .select('quantity, total_price')
        if (error || !sales) return { totalSalesValue: 0, totalUnitsSold: 0 }

        const totalSalesValue = sales.reduce((sum, item) => {
            return sum + item.total_price
        }, 0)
        const totalUnitsSold = sales.reduce((sum, item) => {
            return sum + item.quantity
        }, 0)

        return {
            totalSalesValue,
            totalUnitsSold,
        }
    }

    async getTodaySalesMetrics() {
        const todayStartISO = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z'
        const { data: sales, error } = await this.supabase
            .schema('frostflow_data')
            .from('sales')
            .select('quantity, total_price')
            .gte('created_at', todayStartISO)
            .lte('created_at', new Date().toISOString())
        if (error || !sales) return { todaySalesValue: 0, todayUnitsSold: 0 }

        const todaySalesValue = sales.reduce((sum, item) => {
            return sum + item.total_price
        }, 0)
        const todayUnitsSold = sales.reduce((sum, item) => {
            return sum + item.quantity
        }, 0)

        return {
            todaySalesValue,
            todayUnitsSold,
        }
    }

    async getChartData() {
        const { data, error } = await this.supabase
            .schema('frostflow_data')
            .from('products')
            .select(`
                name,
                unit,
                sales (
                    quantity
                )
            `)
            .limit(10)

        if (error || !data) {
            console.error('Chart Data Error:', error)
            return []
        }

        return data.map((product: any) => ({
            name: product.name,
            current_balance: product.unit,
            total_sold: product.sales?.reduce((sum: number, sale: any) => sum + (sale.quantity || 0), 0) || 0,
        }))
    }

    async getUnreadNotifications() {
        const { data } = await this.supabase
            .schema('frostflow_data')
            .from('notifications')
            .select('*')
            .eq('is_read', false)
            .order('created_at', { ascending: false })
        return data || []
    }

    async markNotificationAsRead(id: string) {
        await this.supabase
            .schema('frostflow_data')
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id)
    }

    async getDailyEntryStatus() {
        const today = new Date().toISOString().split('T')[0]

        const { count: ownerCount } = await this.supabase
            .schema('frostflow_data')
            .from('stock_in')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', today)

        const { count: salesCount } = await this.supabase
            .schema('frostflow_data')
            .from('stock_in_staff')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', today)

        return {
            ownerReady: (ownerCount || 0) > 0,
            salesReady: (salesCount || 0) > 0,
        }
    }

    async getInventoryLogs() {

        const { data, error } = await this.supabase
            .schema('frostflow_data')
            .from('stock_in')
            .select('*, products!product_id(name, category, unit, is_variable_weight, standard_box_weight)')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching inventory logs:', error);
            return [];
        }
        return data || [];
    }



    async getProductHistory(productId: string): Promise<ProductHistoryItem[]> {

        const { data: stockIn, error: errorIn } = await this.supabase
            .schema('frostflow_data')
            .from('stock_in')
            .select('*')
            .eq('product_id', productId);


        const { data: stockOut, error: errorOut } = await this.supabase
            .schema('frostflow_data')
            .from('sales')
            .select('*')
            .eq('product_id', productId);

        if (errorIn || errorOut) {
            console.error('Error fetching history:', errorIn || errorOut);
            return [];
        }


        const history: ProductHistoryItem[] = [
            ...(stockIn || []).map((item) => ({
                id: item.id,
                date: item.created_at,
                type: 'IN' as const,
                quantity: item.quantity,
                unit: item.unit_type,
                original_qty: item.input_quantity,
                original_unit: item.input_unit,
                note: item.reference_note || 'Stock Added'
            })),
            ...(stockOut || []).map((item) => ({
                id: item.id,
                date: item.created_at,
                type: 'OUT' as const,
                quantity: item.quantity,
                unit: item.unit_type,
                note: `Sold via ${item.payment_method}`
            }))
        ];


        return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    async addStockEntry(payload: StockEntry) {
        this.loadingService.show();
        const { data, error } = await this.supabase
            .schema('frostflow_data')
            .from('stock_in')
            .insert(payload)
            .select()
            .single();

        this.loadingService.hide();
        if (error) throw error;


        return data;
    }

    async createStaffUser(payload: { email: string; password: string; name: string; role: string }) {

        const tempClient = createClient(environment.supabase_URL, environment.supabase_anon_key);

        const { data, error } = await tempClient.auth.signUp({
            email: payload.email,
            password: payload.password,
            options: {
                data: {
                    name: payload.name,
                    role: payload.role,
                    is_active: true
                }
            }
        });

        if (error) throw error;


        return data;
    }

    async getStaffList(): Promise<UserProfile[]> {



        const { data, error } = await this.supabase
            .schema('frostflow_data')
            .from('users')
            .select('*')
            .neq('role', 'owner')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching staff:', error);
            return [];
        }
        return (data || []) as UserProfile[];
    }

    async updateStaffStatus(userId: string, isActive: boolean) {
        const { error } = await this.supabase
            .schema('frostflow_data')
            .from('users')
            .update({ is_active: isActive })
            .eq('id', userId);

        if (error) throw error;
        return true;
    }

    subscribeToNotifications(callback: (payload: any) => void) {
        return this.supabase
            .channel('frostflow_data:notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'frostflow_data',
                    table: 'notifications',
                },
                callback
            )
            .subscribe()
    }

    subscribeToProductChanges(callback: (payload: PostgresChangePayload<Product>) => void) {
        return this.supabase
            .channel('frostflow_data:products')
            .on(
                'postgres_changes',
                { event: '*', schema: 'frostflow_data', table: 'products' },
                (payload: any) => callback(payload as PostgresChangePayload<Product>)
            )
            .subscribe()
    }

    subscribeToProfileChanges(userId: string, callback: (payload: PostgresChangePayload<UserProfile>) => void) {
        return this.supabase
            .channel(`frostflow_data:users:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'frostflow_data',
                    table: 'users',
                    filter: `id=eq.${userId}`
                },
                (payload: any) => callback(payload as PostgresChangePayload<UserProfile>)
            )
            .subscribe()
    }

    async getRecentSales() {
        const { data, error } = await this.supabase
            .schema('frostflow_data')
            .from('sales')
            .select('*, products!product_id(name)')
            .order('created_at', { ascending: false })
            .limit(50)

        if (error) {
            console.error('Error fetching recent sales:', error)
            return []
        }
        return data || []
    }
    async addStaffStockEntry(payload: StaffStockEntry) {

        const { data, error } = await this.supabase
            .schema('frostflow_data')
            .from('stock_in_staff')
            .insert(payload)
            .select()
            .single()

        if (error) throw error
        return data
    }

    async getRecentStaffEntries(): Promise<StaffStockEntry[]> {
        const { data, error } = await this.supabase
            .schema('frostflow_data')
            .from('stock_in_staff')
            .select('*, products!product_id(name)')
            .order('created_at', { ascending: false })
            .limit(5)

        if (error) {
            console.error('Error fetching staff entries:', error)
            return []
        }
        const entries = (data || []) as StaffStockEntry[];
        this.staffStock.set(entries);
        return entries;
    }

    subscribeToStaffStockChanges(callback?: (payload: any) => void) {
        return this.supabase
            .channel('frostflow_data:stock_in_staff')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'frostflow_data',
                    table: 'stock_in_staff',
                },
                (payload) => {
                    this.getRecentStaffEntries();
                    if (callback) {
                        callback(payload);
                    }
                }
            )
            .subscribe();
    }



    async getSalesHistory(startDate: string, endDate: string): Promise<Sale[]> {
        this.loadingService.show();
        const { data, error } = await this.withTimeout(this.supabase
            .schema('frostflow_data')
            .from('sales')
            .select('*, products!product_id(name), users!recorded_by(name)')
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .order('created_at', { ascending: false }))

        this.loadingService.hide();
        if (error) {
            console.error('Error fetching sales history:', error);
            return [];
        }
        return (data || []) as Sale[];
    }

    async voidSale(saleId: string, productId: string, quantityToReturn: number, reason: string) {
        this.loadingService.show();

        const { error: saleError } = await this.supabase
            .schema('frostflow_data')
            .from('sales')
            .update({ status: 'voided' })
            .eq('id', saleId);

        if (saleError) {
            this.loadingService.hide();
            throw saleError;
        }


        const { data: product, error: prodError } = await this.supabase
            .schema('frostflow_data')
            .from('products')
            .select('unit, name')
            .eq('id', productId)
            .single();

        if (prodError) throw prodError;

        const { error: updateError } = await this.supabase
            .schema('frostflow_data')
            .from('products')
            .update({ unit: (product.unit || 0) + quantityToReturn })
            .eq('id', productId);

        if (updateError) throw updateError;


        await this.createAuditLog(
            'sales',
            saleId,
            `VOID_TRANSACTION: ${reason}`,
            {
                saleId,
                productId,
                quantity: quantityToReturn,
                productName: product.name,
                previousStatus: 'completed'
            },
            {
                status: 'voided',
                reason: reason,
                returned_to_stock_at: new Date().toISOString()
            }
        );

        this.loadingService.hide();
        return true;
    }

    async getExpenses(startDate: string, endDate: string): Promise<StockEntry[]> {
        this.loadingService.show();

        const { data, error } = await this.withTimeout(this.supabase
            .schema('frostflow_data')
            .from('stock_in')
            .select(`
                *,
                products (name, category)
            `)
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .order('created_at', { ascending: false }));

        this.loadingService.hide();

        if (error) throw error;
        return (data || []) as StockEntry[];
    }
}
