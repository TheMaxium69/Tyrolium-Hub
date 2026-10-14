import { inject, Injectable } from '@angular/core';
import { IHubUser } from '../components/hub-user/hub-user';
import { HubAuthService } from './hub-auth.service';

export type ServerStatus = 'provisioning' | 'active' | 'maintenance' | 'suspended' | 'decommissioned';

export const SERVER_STATUSES: ServerStatus[] = ['provisioning', 'active', 'maintenance', 'suspended', 'decommissioned'];

/** Type de serveur (vps, cloud, db…). Les serveurs s'appellent namePrefix + numéro (db → "database701"). */
export interface IServerType {
  id:           number;
  abbreviation: string;
  namePrefix:   string;
  name:         string;
  description:  string | null;
  createdAt:    string;
}

export interface IServerTypePayload {
  abbreviation: string;
  name:         string;
  namePrefix:   string;
  description:  string | null;
}

/** Résumé d'un serveur tel qu'il apparaît dans un site web (sans client, produit ni auteur). */
export interface IServerSummary {
  id:       number;
  name:     string;
  alias:    string | null;
  hostname: string | null;
  status:   ServerStatus;
  type:     Pick<IServerType, 'id' | 'abbreviation' | 'namePrefix' | 'name'>;
}

/** Serveur du parc SolidServ (l'équivalent d'une Prestation, sur un Produit). */
export interface IServer {
  id:          number;
  name:        string;
  type:        Pick<IServerType, 'id' | 'abbreviation' | 'namePrefix' | 'name'>;
  alias:       string | null;
  description: string | null;
  location:    string | null;
  hostname:    string | null;
  project:     string | null;
  status:      ServerStatus;
  startedAt:   string | null;
  product:     { id: number; tagName: string; displayName: string } | null;
  user:        IHubUser | null;
  clientName:  string | null;
  /** Calculé : user ou clientName renseigné ; false = serveur interne. */
  hasClient:   boolean;
  createdBy:   IHubUser | null;
  createdAt:   string;
}

export interface IServerPayload {
  typeId:      number;
  name:        string;
  alias:       string | null;
  description: string | null;
  location:    string | null;
  hostname:    string | null;
  project:     string | null;
  status:      ServerStatus;
  startedAt:   string | null;
  productId:   number | null;
  userId:      number | null;
  clientName:  string | null;
}

/** Totaux calculés en base (get-stats-server). */
export interface IServerStats {
  total:      number;
  withClient: number;
  internal:   number;
  byStatus:   Record<ServerStatus, number>;
  /** Tous les types, même à 0. */
  byType:     { id: number; abbreviation: string; name: string; servers: number }[];
  byProject:  { project: string | null; servers: number }[];
}

/** Parc de serveurs et types de serveurs SolidServ (routes /solidserv/dashboard/*). */
@Injectable({ providedIn: 'root' })
export class SolidServServerService {
  private readonly auth = inject(HubAuthService);
  private readonly base = '/solidserv/dashboard';

  static readonly SERVER_VIEW = 'PERMS_SOLIDSERV_SERVER_VIEW';
  static readonly TYPE_VIEW   = 'PERMS_SOLIDSERV_SERVERTYPE_VIEW';

  canServer(action: 'create' | 'update' | 'delete') { return this.auth.can(SolidServServerService.SERVER_VIEW, action); }
  canType(action: 'create' | 'update' | 'delete')   { return this.auth.can(SolidServServerService.TYPE_VIEW, action); }
  canViewTypes()     { return this.auth.hasRole(SolidServServerService.TYPE_VIEW); }
  canViewServers()   { return this.auth.hasRole(SolidServServerService.SERVER_VIEW); }
  canPickProduct()   { return this.auth.hasRole('PERMS_SOLIDSERV_PRODUCT_VIEW'); }
  canPickUser()      { return this.auth.hasRole('PERMS_USERITIUM_USER_VIEW'); }
  canViewWebSites()  { return this.auth.hasRole('PERMS_TYROLIUM_WEBSITE_VIEW'); }

  /* ─── Types ───────────────────────────────────────────── */

  getTypes() { return this.auth.requestAll<IServerType>(`${this.base}/get-all-server-type`); }

  createType(payload: IServerTypePayload) {
    return this.auth.request<IServerType>(`${this.base}/post-create-server-type`, { method: 'POST', body: JSON.stringify(payload) });
  }

  /** 409 si on change le namePrefix d'un type utilisé. */
  updateType(id: number, payload: Partial<IServerTypePayload>) {
    return this.auth.request<IServerType>(`${this.base}/put-update-server-type/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  }

  /** 409 si des serveurs utilisent le type. */
  deleteType(id: number) {
    return this.auth.request<null>(`${this.base}/delete-server-type/${id}`, { method: 'DELETE' });
  }

  /* ─── Serveurs ────────────────────────────────────────── */

  getStats() { return this.auth.request<IServerStats>(`${this.base}/get-stats-server`); }

  /** Triés par nom. */
  getServers() { return this.auth.requestAll<IServer>(`${this.base}/get-all-server`); }

  getServer(id: number) { return this.auth.request<IServer>(`${this.base}/get-one-server/${id}`); }

  createServer(payload: IServerPayload) {
    return this.auth.request<IServer>(`${this.base}/post-create-server`, { method: 'POST', body: JSON.stringify(payload) });
  }

  updateServer(id: number, payload: IServerPayload) {
    return this.auth.request<IServer>(`${this.base}/put-update-server/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  }

  deleteServer(id: number) {
    return this.auth.request<null>(`${this.base}/delete-server/${id}`, { method: 'DELETE' });
  }

  /** Nom strict : namePrefix du type + numéro, en minuscules (ex. "vps201", "database701"). */
  isValidName(name: string, type: Pick<IServerType, 'namePrefix'> | null | undefined): boolean {
    return !!type && new RegExp(`^${type.namePrefix}\\d+$`).test(name);
  }
}
