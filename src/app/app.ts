import { Component, ViewEncapsulation } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ITyroUiDashNavItem, TyroUiDashboardLayout } from 'tyrolium-ui';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TyroUiDashboardLayout],
  templateUrl: './app.html',
  styleUrl: './app.css',
  encapsulation: ViewEncapsulation.None,
})
export class App {
  readonly PROJECT_NAME       = 'Tyrolium';
  readonly PROJECT_LOGO       = 'assets/tyrolium-ui/projects/Tyrolium.png';
  readonly PROJECT_LOGO_WHITE = 'assets/tyrolium-ui/projects/Tyrolium-White.png';
  readonly PROJECT_UTILITY    = 'Hub';

  readonly navItems: ITyroUiDashNavItem[] = [
    { label: 'Accueil', icon: 'ri-home-4-line', link: '/' },
    {
      label: 'TyroServ', icon: 'ri-sword-line',
      iconImg: 'assets/tyrolium-ui/projects/TyroServ.png',
      category: true, open: false,
      children: [
        { label: 'Mineirai',    icon: 'ri-forbid-line', link: '/tyroserv/mineirai' },
        {
          label: 'Modération', icon: 'ri-shield-line', open: false,
          children: [
            { label: 'Ban',  icon: 'ri-forbid-line', link: '/tyroserv/moderation/ban' },
            { label: 'Warn', icon: 'ri-alert-line',  link: '/tyroserv/moderation/warn' },
          ]
        },
        { label: 'Statistiques', icon: 'ri-bar-chart-line', link: '/tyroserv/stats' },
      ]
    },{
      label: 'Gamenium', icon: 'ri-sword-line',
      iconImg: 'assets/tyrolium-ui/projects/Gamenium.png',
      category: true, open: false,
      children: [
        { label: 'Mineirai',    icon: 'ri-forbid-line', link: '/tyroserv/mineirai' },
        {
          label: 'Modération', icon: 'ri-shield-line', open: false,
          children: [
            { label: 'Ban',  icon: 'ri-forbid-line', link: '/tyroserv/moderation/ban' },
            { label: 'Warn', icon: 'ri-alert-line',  link: '/tyroserv/moderation/warn' },
          ]
        },
        { label: 'Statistiques', icon: 'ri-bar-chart-line', link: '/tyroserv/stats' },
      ]
    },{
      label: 'Vturias', icon: 'ri-sword-line',
      iconImg: 'assets/tyrolium-ui/projects/Vturias.png',
      category: true, open: false,
      children: [
        { label: 'Mineirai',    icon: 'ri-forbid-line', link: '/tyroserv/mineirai' },
        {
          label: 'Modération', icon: 'ri-shield-line', open: false,
          children: [
            { label: 'Ban',  icon: 'ri-forbid-line', link: '/tyroserv/moderation/ban' },
            { label: 'Warn', icon: 'ri-alert-line',  link: '/tyroserv/moderation/warn' },
          ]
        },
        { label: 'Statistiques', icon: 'ri-bar-chart-line', link: '/tyroserv/stats' },
      ]
    },
  ];
}
