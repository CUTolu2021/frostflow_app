import { Component } from '@angular/core'
import { FormControl, ReactiveFormsModule } from '@angular/forms'
import { Router, RouterOutlet } from '@angular/router'
import { SupabaseService } from '../services/supabase.service'
import { UserRole } from '../enums/role'
import { ToastService } from '../services/toast.service'

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [ReactiveFormsModule],
    templateUrl: './login.component.html',
    styleUrl: './login.component.css',
})
export class LoginComponent {
    constructor(
        private supabase: SupabaseService,
        private router: Router,
        private toast: ToastService
    ) { }

    email = new FormControl('')
    password = new FormControl('')
    passwordVisible: boolean = false

    async handleLogin() {
        const { data, error } = await this.supabase.signInWithPassword(
            this.email.value!,
            this.password.value!
        )

        if (error) {
            console.error('Login failed:', error.message)
            this.toast.show('Login failed: ' + error.message, 'error')
            return
        }

        if (data.session) {
            const profile = await this.supabase.getUserProfile(
                data.session.user.id
            )

            if (profile && !profile.is_active) {
                await this.supabase.signOut()
                this.toast.show('Your account has been disabled. Contact admin.', 'error')
                return
            }

            if (profile && profile.role === UserRole.admin) {
                this.toast.show('Login successful!', 'login')
                this.router.navigate(['/admin'])
            } else if (profile && profile.role === UserRole.sales) {
                this.toast.show('Login successful!', 'login')
                this.router.navigate(['/sales'])
            } else {
                this.router.navigate(['/login'])
                this.toast.show('Unauthorized role. Contact admin.', 'error')
            }
            localStorage.setItem('user_id', data.session.user.id)
            localStorage.setItem('user_role', profile!.role)
            localStorage.setItem('user_name', profile!.name)
            localStorage.setItem('user_email', profile!.email)
        }
    }
    togglePasswordVisibility() {
        this.passwordVisible = !this.passwordVisible
    }
}
