import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { HubAuthService } from '../services/hub-auth.service';

/**
 * Bloque la route si le rôle manque. La navigation initiale part avant que la
 * session soit vérifiée : on attend donc d'avoir un utilisateur et ses droits.
 */
export function permissionGuard(role: string): CanActivateFn {
  return () => {
    const auth   = inject(HubAuthService);
    const router = inject(Router);
    return toObservable(auth.access).pipe(
      filter(access => access !== null),
      take(1),
      map(() => auth.hasRole(role) || router.createUrlTree(['/403'])),
    );
  };
}
