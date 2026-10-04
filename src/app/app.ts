import { Component, computed, effect, inject, ViewEncapsulation } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import {
  ITyroUiDashNavItem, TyroUiConfirmModal, TyroUiDashboardLayout, TyroUiLangService, TyroUiSkeleton, TyroUiSnackbar,
} from 'tyrolium-ui';
import { HUB_CATEGORIES, HUB_SECTIONS, IHubSection } from './config/hub-sections';
import { Login } from './pages/login/login';
import { HubAuthService } from './services/hub-auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TyroUiDashboardLayout, TyroUiSkeleton, TyroUiConfirmModal, TyroUiSnackbar, Login],
  templateUrl: './app.html',
  styleUrl: './app.css',
  encapsulation: ViewEncapsulation.None,
})
export class App {
  readonly auth = inject(HubAuthService);
  private readonly lang   = inject(TyroUiLangService).lang;
  private readonly router = inject(Router);

  readonly PROJECT_NAME       = 'Tyrolium';
  readonly PROJECT_LOGO       = 'assets/tyrolium-ui/projects/Tyrolium.png';
  readonly PROJECT_LOGO_WHITE = 'assets/tyrolium-ui/projects/Tyrolium-White.png';
  readonly PROJECT_UTILITY    = 'Hub';

  /** Sidebar : seuls les onglets dont le rôle "view" est présent dans les droits de l'utilisateur. */
  readonly navItems = computed<ITyroUiDashNavItem[]>(() => {
    const en      = this.lang() === 'en';
    const visible = HUB_SECTIONS.filter(s => this.auth.hasRole(s.role));
    const label   = (s: IHubSection) => en ? s.labelEn : s.label;
    const items: ITyroUiDashNavItem[] = [
      { label: en ? 'Home' : 'Accueil', icon: 'ri-home-4-line', link: '/' },
    ];

    for (const category of HUB_CATEGORIES) {
      const sections = visible.filter(s => s.group === category.group);
      if (!sections.length) continue;
      items.push({
        label: category.label, iconImg: category.iconImg,
        category: true, open: true,
        children: sections.map(s => ({ label: label(s), icon: s.icon, link: `/${s.path}` })),
      });
    }

    const categorized = HUB_CATEGORIES.map(c => c.group);
    for (const s of visible.filter(s => !categorized.includes(s.group))) {
      items.push({
        label: label(s), icon: s.icon, link: `/${s.path}`,
        ...(s.group === 'solidserv' ? { iconImg: 'assets/tyrolium-ui/projects/SolidServ.png' } : {}),
      });
    }

    return items;
  });

  constructor() {
    // Droits relus en cours de session (après un 403) : le guard ne rejoue pas sur la page affichée.
    effect(() => {
      if (!this.auth.access()) return;
      const path    = this.router.url.split(/[?#]/)[0].split('/')[1];
      const section = HUB_SECTIONS.find(s => s.path === path);
      if (section && !this.auth.hasRole(section.role)) this.router.navigateByUrl('/403');
    });
  }
}
