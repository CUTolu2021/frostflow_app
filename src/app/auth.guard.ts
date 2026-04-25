import { inject } from '@angular/core'
import { CanActivateFn, Router } from '@angular/router'
import { SupabaseService } from './services/supabase.service'
import { UserRole } from './enums/role'

export const authGuard: CanActivateFn = async (route, state) => {
    const supabase = inject(SupabaseService)
    const router = inject(Router)

    const user = await supabase.validateSession()

    if (!user) {
        router.navigate(['/login'])
        return false
    }

    const requiredRoles = route.data['roles'] as UserRole[]
    if (!requiredRoles || requiredRoles.length === 0) {
        return false
    }

    if (!user.is_active) {
        await supabase.signOut()
        router.navigate(['/login'])
        return false
    }

    if (user.must_reset_password && !state.url.startsWith('/force-password')) {
        router.navigate(['/force-password'])
        return false
    }

    const userRole: UserRole = user.role as UserRole
    if (requiredRoles.includes(userRole)) {
        return true
    }

    router.navigate(['/login'])
    return false
}
