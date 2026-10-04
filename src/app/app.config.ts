import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { TyroSsoService, TyroUiAuthService } from 'tyrolium-ui';
import { routes } from './app.routes';
import { HubAuthService } from './services/hub-auth.service';
import { HubNoSsoService } from './services/hub-no-sso.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    // Hub = Useritium v3 (tyrolium-api), isolé de la v2 utilisée par les autres sites du workspace.
    // Les composants tyrolium-ui (layout, navbar) injectent TyroUiAuthService → auth v3 du Hub,
    // et le SSO v2 (sso.tyrolium.fr, injecté par les services thème/langue) est neutralisé.
    { provide: TyroUiAuthService, useExisting: HubAuthService },
    { provide: TyroSsoService,    useExisting: HubNoSsoService },
  ],
};
