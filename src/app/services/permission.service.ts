import { inject, Injectable } from '@angular/core';
import { IHubUser } from '../components/hub-user/hub-user';
import { HubAuthService } from './hub-auth.service';
import { IUseritiumUser } from './useritium-admin.service';

/** Permission du catalogue (name au format filiale.perimetre.action). */
export interface IPermission {
  id:                 number;
  name:               string;
  label:              string;
  /** Permissions données en plus quand celle-ci est accordée ("parapluie", ex. *.manage). */
  impliedPermissions: { id: number; name: string; label: string }[];
}

/** Attribution d'une permission (à un compte ou à une clé API). `id` sert au retrait. */
export interface IPermissionGrant {
  id:         number;
  permission: IPermission | null;
  grantedBy:  IHubUser | null;
  grantedAt:  string;
}

/**
 * Gestion des droits du personnel (routes /tyrolium/permission/*), réservée au owner (ROLE_OWNER).
 * Un owner ne peut jamais être modifié via l'API.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly auth = inject(HubAuthService);
  private readonly base = '/tyrolium/permission';

  getCatalog() {
    return this.auth.requestAll<IPermission>(`${this.base}/get-all-permission`);
  }

  /** Comptes interne + owner (deux filtres accessLevel fusionnés). */
  async getStaff(): Promise<{ success: boolean; data: IUseritiumUser[] }> {
    const [interne, owner] = await Promise.all([
      this.auth.requestAll<IUseritiumUser>('/useritium/admin/get-all-user?accessLevel=interne'),
      this.auth.requestAll<IUseritiumUser>('/useritium/admin/get-all-user?accessLevel=owner'),
    ]);
    return {
      success: interne.success && owner.success,
      data:    [...(owner.data ?? []), ...(interne.data ?? [])],
    };
  }

  /** Comptes publics, pour en passer un en interne. */
  getPublicUsers() {
    return this.auth.requestAll<IUseritiumUser>('/useritium/admin/get-all-user?accessLevel=user');
  }

  /** Effet immédiat, sans reconnexion. 409 si déjà accordée. */
  grant(userId: number, permissionId: number) {
    return this.auth.request<IPermissionGrant>(`${this.base}/post-grant-permission`, {
      method: 'POST', body: JSON.stringify({ userId, permissionId }),
    });
  }

  /** `grantId` = id de l'attribution. Invalide toutes les sessions du compte. */
  revoke(grantId: number) {
    return this.auth.request<null>(`${this.base}/delete-user-permission/${grantId}`, { method: 'DELETE' });
  }

  grantInterne(userId: number) {
    return this.auth.request<unknown>(`${this.base}/post-grant-interne-access`, {
      method: 'POST', body: JSON.stringify({ userId }),
    });
  }

  /** Invalide les sessions ; les permissions sont conservées pour un éventuel retour. */
  revokeInterne(userId: number) {
    return this.auth.request<unknown>(`${this.base}/post-revoke-interne-access`, {
      method: 'POST', body: JSON.stringify({ userId }),
    });
  }

  /** "tyrolium.offre.view" → "PERMS_TYROLIUM_OFFRE_VIEW" (forme présente dans roles). */
  roleOf(name: string) {
    return 'PERMS_' + name.toUpperCase().replace(/\./g, '_');
  }
}
