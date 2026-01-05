import { inject } from '@angular/core'
import { CanActivateFn, Router } from '@angular/router'
import { SupabaseService } from './services/supabase.service'
import { roles } from './enums/role'

export const authGuard: CanActivateFn = async (route, state) => {
    const supabase = inject(SupabaseService)
    const router = inject(Router)

    const user = await supabase.getCurrentUser()

    if (!user) {
        router.navigate(['/login'])
        return false
    }

    const requiredRoles = route.data['roles'] as roles[]
    if (!requiredRoles || requiredRoles.length === 0) {
        return false
    }

    const profile = await supabase.getUserProfile(user.id)

    if (!profile || !profile.is_active) {
        await supabase.signOut()
        router.navigate(['/login'])
        return false
    }

    const userRole: roles = profile.role as roles
    if (requiredRoles.includes(userRole)) {
        return true
    }

    router.navigate(['/login'])
    return false
}
