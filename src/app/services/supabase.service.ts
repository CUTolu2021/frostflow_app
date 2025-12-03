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

  

}