import { Routes } from '@angular/router';
import { TyroUiForbidden, TyroUiNotFound } from 'tyrolium-ui';

import { HUB_SECTIONS } from './config/hub-sections';
import { permissionGuard } from './guards/permission.guard';
import { AnalyticsList } from './pages/analytics/analytics-list/analytics-list';
import { ApiKeyDetail } from './pages/api-keys/api-key-detail/api-key-detail';
import { ApiKeysList } from './pages/api-keys/api-keys-list/api-keys-list';
import { AnalyticsProject } from './pages/analytics/analytics-project/analytics-project';
import { Home } from './pages/home/home';
import { Offres } from './pages/offres/offres';
import { StaffDetail } from './pages/permissions/staff-detail/staff-detail';
import { StaffList } from './pages/permissions/staff-list/staff-list';
import { PrestationForm } from './pages/prestations/prestation-form/prestation-form';
import { PrestationsList } from './pages/prestations/prestations-list/prestations-list';
import { UserDetail } from './pages/useritium/user-detail/user-detail';
import { UsersList } from './pages/useritium/users-list/users-list';
import { Section } from './pages/section/section';
import { SolidServProducts } from './pages/solidserv/products/products';
import { SolidServServerForm } from './pages/solidserv/server-form/server-form';
import { SolidServServerTypes } from './pages/solidserv/server-types/server-types';
import { SolidServServers } from './pages/solidserv/servers/servers';
import { WebsiteForm } from './pages/websites/website-form/website-form';
import { WebsitesList } from './pages/websites/websites-list/websites-list';

/** Pages réelles des onglets ; les autres affichent la page provisoire Section. */
const SECTION_ROUTES: Partial<Record<string, Routes>> = {
  analytics: [
    { path: '',    component: AnalyticsList },
    { path: ':id', component: AnalyticsProject },
  ],
  offres: [
    { path: '', component: Offres },
  ],
  prestations: [
    { path: '',    component: PrestationsList },
    // ':id' couvre aussi 'nouvelle' (création).
    { path: ':id', component: PrestationForm },
  ],
  permissions: [
    { path: '',    component: StaffList },
    { path: ':id', component: StaffDetail },
  ],
  'cles-api': [
    { path: '',    component: ApiKeysList },
    { path: ':id', component: ApiKeyDetail },
  ],
  'solidserv/produits': [
    { path: '', component: SolidServProducts },
  ],
  'solidserv/dashboard': [
    { path: '',    component: SolidServServers },
    // ':id' couvre aussi 'nouveau' (création).
    { path: ':id', component: SolidServServerForm },
  ],
  'solidserv/types': [
    { path: '', component: SolidServServerTypes },
  ],
  websites: [
    { path: '',    component: WebsitesList },
    // ':id' couvre aussi 'nouveau' (ajout).
    { path: ':id', component: WebsiteForm },
  ],
  utilisateurs: [
    { path: '',    component: UsersList },
    { path: ':id', component: UserDetail },
  ],
};

export const routes: Routes = [
  { path: '',   component: Home },
  ...HUB_SECTIONS.map(section => ({
    path:        section.path,
    canActivate: [permissionGuard(section.role)],
    data:        { section },
    ...(SECTION_ROUTES[section.path]
      ? { children: SECTION_ROUTES[section.path] }
      : { component: Section }),
  })),
  { path: '403', component: TyroUiForbidden },
  { path: '**',  component: TyroUiNotFound },
];
