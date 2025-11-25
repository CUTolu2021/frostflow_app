import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from './services/supabase.service';
import { roles } from './enums/role';

export const authGuard: CanActivateFn = async (route, state) => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  // 1. Check if a user is logged in
  const user = await supabase.getCurrentUser();

  if (!user) {
    // If no user, redirect to login and block access
    router.navigate(['/login']);
    return false;
  }

  // 2. Check if the route has role requirements
  const requiredRoles = route.data['roles'] as roles[];
  if (!requiredRoles || requiredRoles.length === 0) {
    // If route has no specific roles defined, allow access for any logged-in user
    return false;
  }

  // 3. Check if the user has the required role
  const userRole = user.user_metadata['role'];
  if (requiredRoles.includes(userRole)) {
    // If user has the role, allow access
    return true;
  }

  // 4. If user does not have the role, redirect and block access
  router.navigate(['/login']); // Or a dedicated 'unauthorized' page
  return false;
};