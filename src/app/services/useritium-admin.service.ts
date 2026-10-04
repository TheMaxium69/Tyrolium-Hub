import { inject, Injectable } from '@angular/core';
import { IHubUser } from '../components/hub-user/hub-user';
import { HubAuthService } from './hub-auth.service';

export interface IUseritiumEmail {
  id:         number;
  email:      string;
  isDefault:  boolean;
  isVerified: boolean;
  verifiedAt: string | null;
  createdAt:  string;
}

/** Permission accordée directement à un compte (détail d'un utilisateur). */
export interface IUseritiumUserPermission {
  id:         number;
  permission: { id: number; name: string; label: string } | null;
  grantedBy:  IHubUser | null;
  grantedAt:  string;
}

/** Compte Useritium vu par l'administration (routes /useritium/admin/*). */
export interface IUseritiumUser extends IHubUser {
  id:               number;
  accessLevel:      'user' | 'interne' | 'owner';
  roles:            string[];
  createdAt:        string;
  emails:           IUseritiumEmail[];
  tokensValidSince: string | null;
  bannedAt:         string | null;
  banReason:        string | null;
  /** Uniquement dans get-one-user et les réponses d'action. */
  permissions?:     IUseritiumUserPermission[];
}

/**
 * Administration des comptes Useritium, protégée par permissions
 * (PERMS_USERITIUM_USER_VIEW / _UPDATE / _BAN / _REVOKE, _MANAGE = les quatre, déjà déplié dans roles).
 * Un owner ne peut jamais être modifié, suspendu ni déconnecté (403).
 */
@Injectable({ providedIn: 'root' })
export class UseritiumAdminService {
  private readonly auth = inject(HubAuthService);
  private readonly base = '/useritium/admin';

  /* ─── Permissions ─────────────────────────────────────── */

  /** Pseudo + emails. */
  canUpdate() { return this.auth.hasRole('PERMS_USERITIUM_USER_UPDATE'); }
  /** Suspendre / réactiver. */
  canBan()    { return this.auth.hasRole('PERMS_USERITIUM_USER_BAN'); }
  /** Déconnecter de toutes les sessions. */
  canRevoke() { return this.auth.hasRole('PERMS_USERITIUM_USER_REVOKE'); }

  getAllUsers() {
    return this.auth.requestAll<IUseritiumUser>(`${this.base}/get-all-user`);
  }

  getUser(id: number) {
    return this.auth.request<IUseritiumUser>(`${this.base}/get-one-user/${id}`);
  }

  /** Invalide les sessions ouvertes du compte (le token est lié au pseudo). */
  updateUsername(id: number, username: string) {
    return this.auth.request<IUseritiumUser>(`${this.base}/put-update-user-username/${id}`, {
      method: 'PUT',
      body:   JSON.stringify({ username }),
    });
  }

  /** null (ou chaîne vide) efface le nom affiché ; 100 caractères max. */
  updateDisplayName(id: number, displayName: string | null) {
    return this.auth.request<IUseritiumUser>(`${this.base}/put-update-user-display-name/${id}`, {
      method: 'PUT',
      body:   JSON.stringify({ displayName }),
    });
  }

  /** Retire la photo de profil (fichier supprimé côté API) ; idempotent. */
  deletePp(id: number) {
    return this.auth.request<IUseritiumUser>(`${this.base}/delete-user-pp/${id}`, { method: 'DELETE' });
  }

  /** L'email est créé non vérifié ; 5 max par compte. */
  addEmail(id: number, email: string) {
    return this.auth.request<IUseritiumEmail>(`${this.base}/post-add-user-email/${id}`, {
      method: 'POST',
      body:   JSON.stringify({ email }),
    });
  }

  /** Refusé (409) pour l'email par défaut ou le dernier du compte. */
  deleteEmail(userId: number, emailId: number) {
    return this.auth.request<null>(`${this.base}/delete-user-email/${userId}/${emailId}`, { method: 'DELETE' });
  }

  /** Sessions invalidées et login refusé immédiatement. */
  ban(id: number, reason: string | null) {
    return this.auth.request<IUseritiumUser>(`${this.base}/post-ban-user/${id}`, {
      method: 'POST',
      body:   JSON.stringify({ reason }),
    });
  }

  unban(id: number) {
    return this.auth.request<IUseritiumUser>(`${this.base}/post-unban-user/${id}`, { method: 'POST' });
  }

  /** Déconnecte toutes les sessions sans suspendre le compte. */
  revokeTokens(id: number) {
    return this.auth.request<IUseritiumUser>(`${this.base}/post-revoke-user-tokens/${id}`, { method: 'POST' });
  }

  /** Les actions d'administration sont interdites sur un owner. */
  isEditable(user: IUseritiumUser) {
    return user.accessLevel !== 'owner';
  }

  /** Compte de la personne connectée (id via get-me, sinon pseudo du JWT). */
  isSelf(user: IUseritiumUser) {
    const me = this.auth.me();
    return me ? user.id === me.id : user.username === this.auth.user()?.username;
  }

  defaultEmail(user: IUseritiumUser) {
    return user.emails.find(e => e.isDefault)?.email ?? user.emails[0]?.email ?? '';
  }
}
