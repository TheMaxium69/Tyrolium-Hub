import { Injectable } from '@angular/core';
import type { SsoKey } from 'tyrolium-ui';

/**
 * Remplace TyroSsoService dans le Hub (voir app.config.ts).
 *
 * Le SSO de la lib (sso.tyrolium.fr) appartient à Useritium v2 : redirection au premier
 * chargement, polling toutes les 15 s, partage du token v2 avec les autres sites.
 * Le Hub tourne sur Useritium v3 (tyrolium-api) et doit rester totalement isolé de la v2 :
 * aucun appel n'est fait, le thème et la langue restent mémorisés localement par leurs services.
 */
@Injectable({ providedIn: 'root' })
export class HubNoSsoService {
  on(_key: SsoKey, _handler: (value: string | null, type: 'init' | 'changed') => void): void {}
  post(_key: SsoKey, _value: string | null): void {}
}
