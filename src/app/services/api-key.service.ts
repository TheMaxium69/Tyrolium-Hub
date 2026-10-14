import { inject, Injectable } from '@angular/core';
import { IHubUser } from '../components/hub-user/hub-user';
import { HubAuthService } from './hub-auth.service';
import { IPermissionGrant } from './permission.service';

export type ApiKeyEnvironment = 'live' | 'test';
export type ApiKeyStatus      = 'active' | 'expired' | 'revoked';

/** Clé API d'un système tiers (en-tête X-Api-Key) : uniquement les permissions accordées. */
export interface IApiKey {
  id:          number;
  label:       string;
  content:     string | null;
  environment: ApiKeyEnvironment;
  /** Début de la clé, ex. "tyrokey_live_ed232f6c…". */
  keyPreview:  string;
  expiresAt:   string | null;
  revokedAt:   string | null;
  expired:     boolean;
  createdBy:   IHubUser | null;
  createdAt:   string;
  permissions: IPermissionGrant[];
}

/** Réponse de création : `key` = clé complète, affichée une seule fois, jamais récupérable ensuite. */
export interface IApiKeyCreated extends IApiKey {
  key: string;
}

export interface IApiKeyPayload {
  label:       string;
  environment: ApiKeyEnvironment;
  content?:    string | null;
  /** ISO-8601. */
  expiresAt?:  string | null;
}

/** Clés API (routes /tyrolium/api-key/*), réservées au owner. On ne supprime pas : on révoque. */
@Injectable({ providedIn: 'root' })
export class ApiKeyService {
  private readonly auth = inject(HubAuthService);
  private readonly base = '/tyrolium/api-key';

  getAll() { return this.auth.requestAll<IApiKey>(`${this.base}/get-all-key`); }

  get(id: number) { return this.auth.request<IApiKey>(`${this.base}/get-one-key/${id}`); }

  create(payload: IApiKeyPayload) {
    return this.auth.request<IApiKeyCreated>(`${this.base}/post-create-key`, {
      method: 'POST', body: JSON.stringify(payload),
    });
  }

  /** Immédiat et irréversible (idempotent). */
  revoke(id: number) {
    return this.auth.request<IApiKey>(`${this.base}/post-revoke-key/${id}`, { method: 'POST' });
  }

  grant(apiKeyId: number, permissionId: number) {
    return this.auth.request<IPermissionGrant>(`${this.base}/post-grant-permission`, {
      method: 'POST', body: JSON.stringify({ apiKeyId, permissionId }),
    });
  }

  /** `grantId` = id de l'attribution. */
  removePermission(grantId: number) {
    return this.auth.request<null>(`${this.base}/delete-key-permission/${grantId}`, { method: 'DELETE' });
  }

  status(key: IApiKey): ApiKeyStatus {
    if (key.revokedAt) return 'revoked';
    if (key.expired) return 'expired';
    return 'active';
  }
}
