import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { UserProfile } from '../interfaces/profile';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      environment.supabase_URL,
      environment.supabase_anon_key
    );
  }
  async getCurrentUser(): Promise<User | null> {
    const { data } = await this.supabase.auth.getUser();
    return data.user;
  }

  async signInWithPassword(email: string, password: string) {
    return await this.supabase.auth.signInWithPassword({
      email,
      password,
    });
  }

  async signUpWithPassword(email: string, password: string, options?: any) {
    return await this.supabase.auth.signUp({
      email,
      password,
      options
    });
  }

  async signOut() {
    return await this.supabase.auth.signOut();
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this.supabase
      .schema("frostflow_data")
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
    return data as UserProfile | null;
  }

  async getProducts(): Promise<any[]> {
    const { data, error } = await this.supabase.schema("frostflow_data").from('products').select('*');
    if (error) {
      console.error('Error fetching products:', error);
      return [];
    }
    return data as any[] || [];
  }

  async getAIReports(): Promise<any> {
    const { data, error } = await this.supabase
      .schema("frostflow_data")
      .from('ai_stock_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) {
      console.error('Error fetching AI reports:', error);
      return [];
    }
    return data as any;
  }

  
private async createAuditLog(
  tableName: string,
  recordId: string,
  action: string,
  beforeData: any,
  afterData: any
) {
  
  const { data: { user } } = await this.supabase.auth.getUser();
  const userEmail = user?.email || 'unknown_admin';

  const { error } = await this.supabase
    .schema("frostflow_data")
    .from('audit_logs')
    .insert({
      table_name: tableName,
      record_id: recordId,
      action: action,
      changed_by: userEmail,
      before_data: JSON.stringify(beforeData), 
      after_data: JSON.stringify(afterData)    
    });

  if (error) console.error('Audit Log Failed:', error);
}
  
async getPendingMismatches() {
  
  const { data, error } = await this.supabase
    .schema("frostflow_data")
    .from('reconciliation')
    
    .select('*, products!product_id(name, unit)')
    .neq('status', 'match') 
    .neq('status', 'resolved')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching mismatches:', error);
    return [];
  }
  return data;
}


async resolveMismatch(item:any, finalQuantity: number, resolutionNote: string) {
  
  const { error: invError } = await this.supabase
    .schema("frostflow_data")
    .from('products')
    .update({ unit: item.products.unit + finalQuantity }) 
    .eq('id', item.product_id);

  if (invError) throw invError;

  await this.createAuditLog(
    'reconciliation',         
    item.id,     
    `RESOLVED_MISMATCH: ${resolutionNote}`, 
    { 
      Product: item.products.name,
      Quantity: item.products.unit
     }, 
    { 
      Product: item.products.name,
      Quantity: item.products.unit + finalQuantity
    } 
  );
  const { error: logError } = await this.supabase
    .schema("frostflow_data")
    .from('reconciliation')
    .update({ 
      status: 'resolved',
      
    })
    .eq('id', item.id);

  if (logError) throw logError;
  return true;
}

async getDashboardMetrics() {
  const { data: products, error } = await this.supabase
    .schema("frostflow_data")
    .from('products')
    .select('unit, unit_price');

  if (error || !products) return { totalValue: 0, lowStock: 0, totalItems: 0 };  
  const totalValue = products.reduce((sum, item) => {
    return sum + (item.unit * item.unit_price);
  }, 0);

  
  const lowStock = products.filter(item => item.unit < 10).length;
  const totalItems = products.length;

  return {
    totalValue,
    lowStock,
    totalItems
  };
}

async getSalesDashboardMetrics() {
  const { data: sales, error } = await this.supabase
    .schema("frostflow_data")
    .from('sales')
    .select('quantity, total_price');
  if (error || !sales) return { totalSalesValue: 0, totalUnitsSold: 0 };  

  const totalSalesValue = sales.reduce((sum, item) => {
    return sum + (item.total_price);
  }, 0);
  const totalUnitsSold = sales.reduce((sum, item) => {
    return sum + (item.quantity);
  }, 0);

  return {
    totalSalesValue,
    totalUnitsSold
  };
}

async getChartData() {
  const { data, error } = await this.supabase
    .from('inventory_balance')
    .select(`
      current_balance,
      total_sold,
      products ( name )
    `)
    .limit(10); 

  if (error) {
    console.error('Chart Data Error:', error);
    return [];
  }
  return data;
}



async getUnreadNotifications() {
  const { data } = await this.supabase
  .schema("frostflow_data")
    .from('notifications')
    .select('*')
    .eq('is_read', false)
    .order('created_at', { ascending: false });
  return data || [];
}


async markNotificationAsRead(id: string) {
  await this.supabase
  .schema("frostflow_data")
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);
}


async getDailyEntryStatus() {
  const today = new Date().toISOString().split('T')[0];
  console.log('Today:', today); 

  
  const { count: ownerCount } = await this.supabase
  .schema("frostflow_data")
    .from('stock_in')
    .select('*', { count: 'exact', head: true }) 
    .gte('created_at', today);

  
  const { count: salesCount } = await this.supabase
  .schema("frostflow_data")
    .from('stock_in_staff')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today);

    console.log('Owner Count:', ownerCount);
    console.log('Sales Count:', salesCount);

  return {
    ownerReady: (ownerCount || 0) > 0,
    salesReady: (salesCount || 0) > 0
  };
}


subscribeToNotifications(callback: (payload: any) => void) {
  return this.supabase
    .channel('frostflow_data:notifications')
    .on(
      'postgres_changes', 
      { event: 'INSERT', schema: 'frostflow_data', table: 'notifications' }, 
      callback
    )
    .subscribe();
}
}