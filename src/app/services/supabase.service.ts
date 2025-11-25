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

  // --- Authentication ---

  // 1. Helper to get the currently active user (if they are already logged in)
  async getCurrentUser(): Promise<User | null> {
    const { data } = await this.supabase.auth.getUser();
    return data.user;
  }

  // 2. Login (Returns the session)
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


  // 3. Logout
  async signOut() {
    return await this.supabase.auth.signOut();
  }

  // --- Database Logic ---

  // 4. Get Profile (Matches YOUR table schema)
  async getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await this.supabase
    .schema("frostflow_data")
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  console.log("Raw data from Supabase:", data); // <--- Add this line
  console.log("Error from Supabase:", error); // <--- Add this line

  return data as any | null;
}


//   get session() {
//   return this.supabase.auth.getSession();
// }

  async getProducts(): Promise<any[]> {
    const { data, error } = await this.supabase.schema("frostflow_data").from('products').select('*');
    console.log("Data from supabase service",data);
    return data as any[];
  }

  

}