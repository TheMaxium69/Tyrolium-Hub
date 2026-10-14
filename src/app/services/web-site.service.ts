import { inject, Injectable } from '@angular/core';
import { IHubUser } from '../components/hub-user/hub-user';
import { HubAuthService } from './hub-auth.service';
import { PrestationStatus } from './prestation.service';
import { IServerSummary } from './solidserv-server.service';

export type WebSiteOwnerType = 'filiale' | 'client';
export type WebSiteStatus    = 'active' | 'maintenance' | 'suspended' | 'archived';
export type WebSiteFiliale   = 'tyrolium' | 'useritium' | 'solidserv' | 'tyroserv' | 'gamenium' | 'vturias' | 'influnias' | 'tyrociel';

export const WEB_SITE_FILIALES: { value: WebSiteFiliale; label: string; logo: string }[] = [
  { value: 'tyrolium',  label: 'Tyrolium',  logo: 'assets/tyrolium-ui/projects/Tyrolium.png'  },
  { value: 'useritium', label: 'Useritium', logo: 'assets/tyrolium-ui/projects/Useritium.png' },
  { value: 'solidserv', label: 'SolidServ', logo: 'assets/tyrolium-ui/projects/SolidServ.png' },
  { value: 'tyroserv',  label: 'TyroServ',  logo: 'assets/tyrolium-ui/projects/TyroServ.png'  },
  { value: 'gamenium',  label: 'Gamenium',  logo: 'assets/tyrolium-ui/projects/Gamenium.png'  },
  { value: 'vturias',   label: 'Vturias',   logo: 'assets/tyrolium-ui/projects/Vturias.png'   },
  { value: 'influnias', label: 'Influnias', logo: 'assets/tyrolium-ui/projects/Influnias.png' },
  { value: 'tyrociel',  label: 'TyroCiel',  logo: 'assets/tyrolium-ui/projects/TyroCiel.png'  },
];

export const WEB_SITE_STATUSES: WebSiteStatus[] = ['active', 'maintenance', 'suspended', 'archived'];

/** Site web / nom de domaine du registre Tyrolium : appartient à une filiale ou à un client. */
export interface IWebSite {
  id:              number;
  /** Unique, en minuscules, sans protocole ni chemin. */
  domainName:      string;
  name:            string;
  description:     string | null;
  ownerType:       WebSiteOwnerType;
  filiale:         WebSiteFiliale | null;
  prestation:      { id: number; offre: { id: number; tagName: string; displayName: string }; clientName: string | null; status: PrestationStatus } | null;
  user:            IHubUser | null;
  clientName:      string | null;
  status:          WebSiteStatus;
  registrar:       string | null;
  /** AAAA-MM-JJ */
  domainExpiresAt: string | null;
  /** Calculé par l'API : négatif = déjà expiré, null = pas d'échéance. */
  daysUntilExpiry: number | null;
  /** Renouvellement automatique du NOM DE DOMAINE (les champs ssl* concernent le certificat). */
  autoRenew:       boolean;
  /** Certificat SSL : échéance AAAA-MM-JJ, renouvellement auto, émetteur (Let's Encrypt…). */
  sslExpiresAt:       string | null;
  sslAutoRenew:       boolean;
  sslProvider:        string | null;
  sslDaysUntilExpiry: number | null;
  /** https://…, ssh://… ou git@hote:chemin. */
  gitRepository:      string | null;
  /** Serveur SolidServ qui héberge le site (résumé), ou null si non rattaché. */
  server:             IServerSummary | null;
  createdBy:       IHubUser | null;
  createdAt:       string;
}

/**
 * Corps de création / modification. En modification, seules les clés envoyées changent :
 * le formulaire envoie toujours l'état complet, avec les champs de l'autre type de propriétaire à null.
 */
export interface IWebSitePayload {
  domainName:      string;
  name:            string;
  description:     string | null;
  ownerType:       WebSiteOwnerType;
  filiale:         WebSiteFiliale | null;
  prestationId:    number | null;
  userId:          number | null;
  clientName:      string | null;
  status:          WebSiteStatus;
  registrar:       string | null;
  domainExpiresAt: string | null;
  autoRenew:       boolean;
  sslExpiresAt:    string | null;
  sslAutoRenew:    boolean;
  sslProvider:     string | null;
  gitRepository:   string | null;
  /** null détache le site de son serveur. */
  serverId:        number | null;
}

/** Registre des sites web (routes /tyrolium/web-site/*). */
@Injectable({ providedIn: 'root' })
export class WebSiteService {
  private readonly auth = inject(HubAuthService);
  private readonly base = '/tyrolium/web-site';

  static readonly VIEW_ROLE = 'PERMS_TYROLIUM_WEBSITE_VIEW';

  can(action: 'create' | 'update' | 'delete') { return this.auth.can(WebSiteService.VIEW_ROLE, action); }
  canPickPrestation() { return this.auth.hasRole('PERMS_TYROLIUM_PRESTATION_VIEW'); }
  canPickUser()       { return this.auth.hasRole('PERMS_USERITIUM_USER_VIEW'); }
  canViewServers()    { return this.auth.hasRole('PERMS_SOLIDSERV_SERVER_VIEW'); }

  /** Triée par nom de domaine. */
  getAll() { return this.auth.requestAll<IWebSite>(`${this.base}/get-all-web-site`); }

  /** Expire dans `days` jours (1-365) ou déjà expiré, archivés exclus, du plus urgent au moins urgent. */
  getExpiring(days = 30) { return this.auth.requestAll<IWebSite>(`${this.base}/get-expiring-web-site?days=${days}`); }

  /** Certificat SSL qui expire dans `days` jours ou déjà expiré, archivés exclus, du plus urgent au moins urgent. */
  getExpiringSsl(days = 30) { return this.auth.requestAll<IWebSite>(`${this.base}/get-expiring-ssl-web-site?days=${days}`); }

  get(id: number) { return this.auth.request<IWebSite>(`${this.base}/get-one-web-site/${id}`); }

  /** Sites hébergés par un serveur SolidServ. */
  getByServer(serverId: number) {
    return this.auth.requestAll<IWebSite>(`${this.base}/get-all-web-site?serverId=${serverId}`);
  }

  create(payload: IWebSitePayload) {
    return this.auth.request<IWebSite>(`${this.base}/post-create-web-site`, { method: 'POST', body: JSON.stringify(payload) });
  }

  update(id: number, payload: IWebSitePayload) {
    return this.auth.request<IWebSite>(`${this.base}/put-update-web-site/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  }

  delete(id: number) {
    return this.auth.request<null>(`${this.base}/delete-web-site/${id}`, { method: 'DELETE' });
  }

  /** Ouvre le site dans un nouvel onglet (https, sans accès à cette page depuis l'onglet ouvert). */
  launch(site: IWebSite) {
    window.open(`https://${site.domainName}`, '_blank', 'noopener,noreferrer');
  }

  filiale(value: WebSiteFiliale | null) {
    return WEB_SITE_FILIALES.find(f => f.value === value) ?? null;
  }
}
