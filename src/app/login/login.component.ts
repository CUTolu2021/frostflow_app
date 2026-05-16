import { Component } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormControl, ReactiveFormsModule } from '@angular/forms'
import { Router, RouterOutlet } from '@angular/router'
import { SupabaseService } from '../services/supabase.service'
import { UserRole } from '../enums/role'
import { ToastService } from '../services/toast.service'

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
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
            this.toast.show(error.message || 'Login failed', 'error')
            return
        }

        if (data.session) {
            const user = data.session.user

            if (!user.is_active) {
                await this.supabase.signOut()
                this.toast.show('Your account has been disabled. Contact admin.', 'error')
                return
            }

            if (user.role === UserRole.admin || user.role === UserRole.manager) {
                this.toast.show('Login successful!', 'login')
                this.router.navigate(['/admin'])
            } else if (user.role === UserRole.superadmin) {
                this.toast.show('Login successful!', 'login')
                this.router.navigate(['/superadmin'])
            } else if (user.role === UserRole.sales) {
                this.toast.show('Login successful!', 'login')
                this.router.navigate(['/sales'])
            } else {
                this.router.navigate(['/login'])
                this.toast.show('Unauthorized role. Contact admin.', 'error')
            }
        }
    }
    togglePasswordVisibility() {
        this.passwordVisible = !this.passwordVisible
    }
}
