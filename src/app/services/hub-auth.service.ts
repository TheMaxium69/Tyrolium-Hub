import { computed, inject, Injectable, signal } from '@angular/core';
import { ITyroUiUser, TyroUiLangService } from 'tyrolium-ui';
import { API_URL, IApiResponse } from '../config/api';

const TOKEN_KEY = 'tyrolium-hub-token';
/** Ancienne clé (profil mis en cache) : n'est plus écrite, seulement nettoyée. */
const USER_KEY  = 'tyrolium-hub-user';

/** Réponse de GET /tyrolium/permission/get-my-permission (rôles recalculés depuis la DB). */
export interface IHubAccess {
  accessLevel: 'user' | 'interne' | 'owner';
  roles:       string[];
  permissions: unknown[];
}

/** Compte connecté (GET /useritium/account/get-me) : rien d'admin dedans. */
export interface IHubMe {
  id:          number;
  username:    string;
  displayName: string | null;
  /** Chemin relatif à API_URL, ou null. */
  pp:          string | null;
  emails:      { id: number; email: string; isDefault: boolean; isVerified: boolean }[];
}

interface IJwtPayload {
  username: string;
  exp:      number;
}

type HubAuthError = 'credentials' | 'forbidden' | 'network' | 'expired' | 'unknown';

/**
 * Auth du Hub sur tyrolium-api (JWT Useritium).
 *
 * Fournie à la place de TyroUiAuthService (voir app.config.ts) : elle en reprend
 * l'API publique (user, loading, error, modal*, login, logout, getToken) pour que
 * les composants tyrolium-ui (dashboard layout, navbar) fonctionnent tels quels.
 */
@Injectable({ providedIn: 'root' })
export class HubAuthService {
  private readonly lang = inject(TyroUiLangService).lang;

  readonly user      = signal<ITyroUiUser | null>(null);
  readonly access    = signal<IHubAccess | null>(null);
  /** Profil du compte connecté (id, nom affiché, pp…) ; null si get-me a échoué. */
  readonly me        = signal<IHubMe | null>(null);
  readonly loading   = signal(false);
  /** false tant que la session stockée n'a pas été vérifiée auprès de l'API. */
  readonly ready     = signal(false);
  readonly modalOpen = signal(false);
  readonly modalTab  = signal<'login' | 'register'>('login');

  private readonly errorKey = signal<HubAuthError | null>(null);
  /** Message brut renvoyé par l'API quand il est destiné à l'utilisateur. */
  private readonly rawError = signal<string | null>(null);
  /** Message d'erreur traduit (FR/EN), suit la langue courante. */
  readonly error = computed(() => {
    const key = this.errorKey();
    return key ? this.translateError(key) : null;
  });

  readonly roles = computed(() => this.access()?.roles ?? []);

  private expiryTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.restoreSession();
  }

  /* ─── API compatible TyroUiAuthService ───────────────── */

  /** Pas de modal dans le Hub : la page de connexion s'affiche dès qu'il n'y a pas de session. */
  openModal(_tab: 'login' | 'register' = 'login') {}
  closeModal() {}

  async login(identifier: string, password: string): Promise<void> {
    this.loading.set(true);
    this.errorKey.set(null);
    try {
      const res  = await fetch(`${API_URL}/useritium/account/post-login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ identifier, password }),
      });
      const body = await res.json() as IApiResponse<{ token: string }>;

      if (!body.success || !body.data?.token) {
        // Seul autre message possible de l'API ici : "email non vérifié", volontairement actionnable → affiché tel quel.
        this.rawError.set(body.message && body.message !== 'Identifiants invalides.' ? body.message : null);
        this.errorKey.set('credentials');
        return;
      }

      const ok = await this.openSession(body.data.token);
      if (!ok && !this.errorKey()) this.errorKey.set('unknown');
    } catch {
      this.errorKey.set('network');
    } finally {
      this.loading.set(false);
    }
  }

  logout() {
    this.clearSession();
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * `roles` arrive déjà déplié par l'API (une permission "manage" inclut celles qu'elle implique).
   * ROLE_OWNER bypasse tout côté API (OwnerBypassVoter) : même règle ici.
   */
  hasRole(role: string): boolean {
    const roles = this.roles();
    return roles.includes('ROLE_OWNER') || roles.includes(role);
  }

  /**
   * Droit d'action sur un domaine : PERMS_TYROLIUM_OFFRE_VIEW + 'create' → PERMS_TYROLIUM_OFFRE_CREATE.
   * Sert à afficher/masquer les boutons d'action.
   */
  can(viewRole: string, action: 'create' | 'update' | 'delete'): boolean {
    return this.hasRole(viewRole.replace(/_VIEW$/, `_${action.toUpperCase()}`));
  }

  /**
   * Relit les droits depuis l'API (jamais depuis le JWT, qui peut être périmé jusqu'à 1h).
   * Appelé au chargement de l'app et après un 403.
   */
  async refreshAccess(): Promise<void> {
    const token = this.getToken();
    if (!token) return;
    const res  = await fetch(`${API_URL}/tyrolium/permission/get-my-permission`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json() as IApiResponse<IHubAccess>;
    if (res.status === 401) {
      this.clearSession();
      this.errorKey.set('expired');
    } else if (body.success && body.data) {
      if (!this.isInterne(body.data)) {
        this.clearSession();
        this.errorKey.set('forbidden');
      } else {
        this.access.set(body.data);
      }
    }
  }

  /** fetch authentifié vers tyrolium-api ; un 401 ferme la session, un 403 relit les droits. */
  async request<T>(path: string, init: RequestInit = {}): Promise<IApiResponse<T>> {
    const token = this.getToken();
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    const body = await res.json().catch(() => ({
      success: res.ok, code: res.status, message: '', data: null,
    })) as IApiResponse<T>;
    if (res.status === 401) {
      this.clearSession();
      this.errorKey.set('expired');
    } else if (res.status === 403) {
      await this.refreshAccess();
    }
    return body;
  }

  /**
   * Route de liste paginée : récupère toutes les pages (limit max = 100) et les concatène.
   * Utile tant que les stats sont calculées côté front, faute de route de totaux.
   */
  async requestAll<T>(path: string): Promise<IApiResponse<T[]>> {
    const sep   = path.includes('?') ? '&' : '?';
    const first = await this.request<T[]>(`${path}${sep}page=1&limit=100`);
    const pages = first.meta?.pagination?.pages ?? 1;
    if (!first.success || pages <= 1) return first;

    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) => this.request<T[]>(`${path}${sep}page=${i + 2}&limit=100`)),
    );
    const failed = rest.find(r => !r.success);
    if (failed) return failed;
    return { ...first, data: [first.data ?? [], ...rest.map(r => r.data ?? [])].flat() };
  }

  /* ─── Session ────────────────────────────────────────── */

  /**
   * Vérifie le token auprès de l'API (rôles à jour, token non révoqué) puis
   * ouvre la session uniquement pour un compte interne ou owner.
   */
  private async openSession(token: string): Promise<boolean> {
    const payload = this.decodeJwt(token);
    if (!payload || payload.exp * 1000 <= Date.now()) {
      this.clearSession();
      this.errorKey.set('expired');
      return false;
    }

    const [res, me] = await Promise.all([
      fetch(`${API_URL}/tyrolium/permission/get-my-permission`, { headers: { Authorization: `Bearer ${token}` } }),
      this.fetchMe(token),
    ]);
    const body = await res.json() as IApiResponse<IHubAccess>;

    if (!body.success || !body.data) {
      this.clearSession();
      this.errorKey.set(res.status === 401 ? 'expired' : 'unknown');
      return false;
    }

    // L'API accepte encore le login d'un compte "user" : c'est au Hub de bloquer.
    if (!this.isInterne(body.data)) {
      this.clearSession();
      this.errorKey.set('forbidden');
      return false;
    }

    localStorage.setItem(TOKEN_KEY, token);
    this.access.set(body.data);
    this.setMe(me, payload.username, token);
    this.errorKey.set(null);
    this.rawError.set(null);
    this.scheduleExpiry(payload.exp);
    return true;
  }

  /** Profil du compte connecté ; null en cas d'échec (le Hub reste utilisable avec le pseudo du JWT). */
  private async fetchMe(token: string): Promise<IHubMe | null> {
    try {
      const res  = await fetch(`${API_URL}/useritium/account/get-me`, { headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json() as IApiResponse<IHubMe>;
      return body.success ? body.data : null;
    } catch {
      return null;
    }
  }

  /**
   * Utilisateur exposé aux composants tyrolium-ui (navbar, layout) au format ITyroUiUser.
   * pp volontairement null : la navbar préfixe encore les pp au format Useritium v2,
   * elle affiche donc l'avatar à l'initiale (sur le nom affiché) en attendant.
   */
  private setMe(me: IHubMe | null, fallbackUsername: string, token: string) {
    this.me.set(me);
    this.user.set({
      id:          me?.id ?? 0,
      email:       me?.emails.find(e => e.isDefault)?.email ?? me?.emails[0]?.email ?? '',
      username:    me?.username ?? fallbackUsername,
      displayname: me?.displayName ?? null,
      pp:          null,
      webToken:    token,
    });
  }

  private async restoreSession() {
    const token = this.getToken();
    if (token) {
      try {
        await this.openSession(token);
        // Session expirée au rechargement : on revient simplement sur le login, sans message.
        if (this.errorKey() === 'expired') this.errorKey.set(null);
      } catch {
        this.errorKey.set('network');
      }
    }
    this.ready.set(true);
  }

  private clearSession() {
    clearTimeout(this.expiryTimer);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.access.set(null);
    this.me.set(null);
    this.user.set(null);
  }

  /** Le JWT dure 1h (token_ttl côté API) : déconnexion automatique à l'expiration. */
  private scheduleExpiry(exp: number) {
    clearTimeout(this.expiryTimer);
    this.expiryTimer = setTimeout(() => {
      this.clearSession();
      this.errorKey.set('expired');
    }, exp * 1000 - Date.now());
  }

  private isInterne(access: IHubAccess): boolean {
    return access.accessLevel === 'interne' || access.accessLevel === 'owner';
  }

  /** Lecture du JWT pour le username et l'expiration uniquement, jamais pour les droits. */
  private decodeJwt(token: string): IJwtPayload | null {
    try {
      const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const bytes = Uint8Array.from(atob(part), c => c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes)) as IJwtPayload;
    } catch {
      return null;
    }
  }

  private translateError(key: HubAuthError): string {
    const en = this.lang() === 'en';
    switch (key) {
      case 'credentials':
        return this.rawError() ?? (en ? 'Invalid credentials.' : 'Identifiants invalides.');
      case 'forbidden':
        return en
          ? 'Access restricted to Tyrolium internal staff.'
          : 'Accès réservé au personnel interne de Tyrolium.';
      case 'network':
        return en
          ? 'Unable to reach Tyrolium API. Please try again later.'
          : 'Impossible de contacter l\'API Tyrolium. Réessayez plus tard.';
      case 'expired':
        return en
          ? 'Your session has expired, please sign in again.'
          : 'Votre session a expiré, veuillez vous reconnecter.';
      default:
        return en ? 'An error occurred.' : 'Une erreur est survenue.';
    }
  }
}
