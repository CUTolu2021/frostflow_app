import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterOutlet } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { roles } from '../enums/role';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  //name = new FormControl('');
  constructor(private supabase: SupabaseService, private router: Router) {}

  email = new FormControl('');
  password = new FormControl('');
  passwordVisible: boolean = false;

  async handleLogin() {
    const { data, error } = await this.supabase.signInWithPassword(
      this.email.value!,
      this.password.value!
    );
//console.log(data.user?.email);
    if (error) {
      console.error('Login failed:', error.message);
      alert('Login failed: ' + error.message);
      return;
    }

    if (data.session) {
      const profile = await this.supabase.getUserProfile(data.session.user.id);
      //console.log(profile);
      if (profile && profile.role === roles.admin) {
        alert('Login successful');
        this.router.navigate(['/admin']);
      } else if (profile && profile.role === roles.sales) {
        alert('Login successful');
        this.router.navigate(['/sales']);
      } else {
        this.router.navigate(['/login']);
        alert('Login failed');
      }
      localStorage.setItem('user_id', data.session.user.id);
      localStorage.setItem('user_role', profile!.role);
      localStorage.setItem('user_name', profile!.name);
      localStorage.setItem('user_email', profile!.email);
    }
        
        
  }
  togglePasswordVisibility() {
    this.passwordVisible = !this.passwordVisible;
  }


}
