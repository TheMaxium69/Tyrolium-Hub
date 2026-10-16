import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ITyroUiBarChartItem, TyroUiAlert, TyroUiAvatar, TyroUiBarChart, TyroUiBentoCard, TyroUiButton,
  TyroUiButtonBento, TyroUiChip, TyroUiLangService, TyroUiSkeleton,
} from 'tyrolium-ui';
import { AccessLevel } from '../../components/access-level/access-level';
import { hubUserName } from '../../components/hub-user/hub-user';
import { apiAsset } from '../../config/api';
import { HUB_CATEGORIES, HUB_SECTIONS, IHubSection } from '../../config/hub-sections';
import { AnalyticsService, IAnalyticsStats } from '../../services/analytics.service';
import { HubAuthService } from '../../services/hub-auth.service';
import { PrestationService } from '../../services/prestation.service';
import { SolidServProductService } from '../../services/solidserv-product.service';
import { IServerStats, SolidServServerService } from '../../services/solidserv-server.service';
import { WebSiteService } from '../../services/web-site.service';
import { formatPrice } from '../../utils/format';

/** Point d'attention de l'accueil (n'apparaît que s'il y a quelque chose à faire). */
interface IAttention {
  key:     string;
  count:   number;
  label:   string;
  icon:    string;
  variant: 'danger' | 'warning' | 'accent';
  link:    string;
}

/** Courte description de chaque onglet, pour les accès rapides. */
const SECTION_HINTS: Record<string, { fr: string; en: string }> = {
  'analytics':           { fr: 'Fréquentation des sites',        en: 'Website traffic' },
  'offres':              { fr: 'Catalogue des offres',           en: 'Offer catalogue' },
  'prestations':         { fr: 'Offres vendues aux clients',     en: 'Offers sold to clients' },
  'permissions':         { fr: 'Droits du personnel',            en: 'Staff permissions' },
  'cles-api':            { fr: 'Accès des systèmes tiers',       en: 'Third-party access' },
  'websites':            { fr: 'Domaines, SSL et hébergement',   en: 'Domains, SSL and hosting' },
  'utilisateurs':        { fr: 'Comptes Useritium',              en: 'Useritium accounts' },
  'solidserv/produits':  { fr: 'Catalogue des serveurs',         en: 'Server catalogue' },
  'solidserv/dashboard': { fr: 'Parc de serveurs',               en: 'Server fleet' },
  'solidserv/types':     { fr: 'Nommage du parc',                en: 'Fleet naming' },
  'support':             { fr: 'Bientôt disponible',             en: 'Coming soon' },
};

/** Accueil du Hub : bienvenue, points d'attention, aperçus et accès rapides, selon les droits du compte. */
@Component({
  selector: 'app-home',
  imports: [
    RouterLink, TyroUiBentoCard, TyroUiButtonBento, TyroUiButton, TyroUiChip, TyroUiAvatar, TyroUiBarChart,
    TyroUiAlert, TyroUiSkeleton, AccessLevel,
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  readonly lang = inject(TyroUiLangService).lang;
  readonly auth = inject(HubAuthService);
  private readonly analytics   = inject(AnalyticsService);
  private readonly prestations = inject(PrestationService);
  private readonly products    = inject(SolidServProductService);
  private readonly servers     = inject(SolidServServerService);
  private readonly webSites    = inject(WebSiteService);

  /* ─── Bienvenue ──────────────────────────────────────── */

  readonly name   = computed(() => {
    const me = this.auth.me();
    return me ? hubUserName(me) : this.auth.user()?.username ?? '';
  });
  readonly avatar = computed(() => apiAsset(this.auth.me()?.pp));
  readonly level  = computed(() => this.auth.access()?.accessLevel ?? 'interne');

  readonly greeting = computed(() => {
    const h  = new Date().getHours();
    const en = this.lang() === 'en';
    if (h < 6 || h >= 18) return en ? 'Good evening' : 'Bonsoir';
    if (h < 12) return en ? 'Good morning' : 'Bonjour';
    return en ? 'Good afternoon' : 'Bon après-midi';
  });

  readonly today = computed(() => new Date().toLocaleDateString(this.lang() === 'en' ? 'en-GB' : 'fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }));

  /* ─── Accès rapides (onglets visibles, groupés) ──────── */

  readonly visible = computed(() => HUB_SECTIONS.filter(s => this.auth.hasRole(s.role)));

  readonly groups = computed(() => {
    const en = this.lang() === 'en';
    const groups = HUB_CATEGORIES
      .map(c => ({ label: c.label, iconImg: c.iconImg as string | null, sections: this.visible().filter(s => s.group === c.group) }))
      .filter(g => g.sections.length);
    const others = this.visible().filter(s => !HUB_CATEGORIES.some(c => c.group === s.group));
    if (others.length) groups.push({ label: en ? 'Other' : 'Autres', iconImg: null, sections: others });
    return groups;
  });

  label(s: IHubSection) { return this.lang() === 'en' ? s.labelEn : s.label; }
  hint(s: IHubSection) {
    const h = SECTION_HINTS[s.path];
    return h ? (this.lang() === 'en' ? h.en : h.fr) : '';
  }

  /* ─── Données des aperçus (chacune selon sa permission) ─ */

  readonly canAnalytics   = computed(() => this.auth.hasRole(AnalyticsService.VIEW_ROLE));
  readonly canWebSites    = computed(() => this.auth.hasRole(WebSiteService.VIEW_ROLE));
  readonly canServers     = computed(() => this.auth.hasRole(SolidServServerService.SERVER_VIEW));
  readonly canPrestations = computed(() => this.auth.hasRole(PrestationService.PRESTATION_VIEW));
  readonly canProducts    = computed(() => this.auth.hasRole(SolidServProductService.VIEW_ROLE));

  readonly loading        = signal(true);
  readonly traffic        = signal<IAnalyticsStats | null>(null);
  readonly serverStats    = signal<IServerStats | null>(null);
  readonly domainsToRenew = signal(0);
  readonly sslToRenew     = signal(0);
  readonly expiredCount   = signal(0);
  readonly pending        = signal(0);
  readonly activeValue    = signal<number | null>(null);
  readonly outOfStock     = signal(0);

  readonly trafficChart = computed<ITyroUiBarChartItem[]>(() => {
    const en    = this.lang() === 'en';
    const byDay = new Map((this.traffic()?.visitsPerDay ?? []).map(d => [d.day, d]));
    const range = this.analytics.range('7d');
    const items: ITyroUiBarChartItem[] = [];
    const day = new Date(`${range.from}T00:00:00`);
    for (let i = 0; i < 7; i++) {
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      const d = byDay.get(key);
      items.push({
        label:   day.toLocaleDateString(en ? 'en-GB' : 'fr-FR', { weekday: 'short' }),
        value:   d?.visits ?? 0,
        details: [{ label: en ? 'unique visitors' : 'visiteurs uniques', value: d?.uniqueVisitors ?? 0 }],
      });
      day.setDate(day.getDate() + 1);
    }
    return items;
  });

  /** Ce qui demande une action, du plus urgent au moins urgent. Vide = rien à signaler. */
  readonly attention = computed<IAttention[]>(() => {
    const en = this.lang() === 'en';
    const s  = this.serverStats();
    const plural = (n: number, fr: string, frs: string, enS: string, enP: string) => en ? (n > 1 ? enP : enS) : (n > 1 ? frs : fr);
    const items: IAttention[] = [
      { key: 'domains', count: this.domainsToRenew(), icon: 'ri-global-line', variant: 'warning', link: '/websites',
        label: plural(this.domainsToRenew(), 'domaine à renouveler', 'domaines à renouveler', 'domain to renew', 'domains to renew') },
      { key: 'ssl', count: this.sslToRenew(), icon: 'ri-lock-unlock-line', variant: 'warning', link: '/websites',
        label: plural(this.sslToRenew(), 'certificat SSL à renouveler', 'certificats SSL à renouveler', 'SSL certificate to renew', 'SSL certificates to renew') },
      { key: 'suspended', count: s?.byStatus.suspended ?? 0, icon: 'ri-pause-circle-line', variant: 'danger', link: '/solidserv/dashboard',
        label: plural(s?.byStatus.suspended ?? 0, 'serveur suspendu', 'serveurs suspendus', 'suspended server', 'suspended servers') },
      { key: 'maintenance', count: s?.byStatus.maintenance ?? 0, icon: 'ri-tools-line', variant: 'warning', link: '/solidserv/dashboard',
        label: plural(s?.byStatus.maintenance ?? 0, 'serveur en maintenance', 'serveurs en maintenance', 'server in maintenance', 'servers in maintenance') },
      { key: 'provisioning', count: s?.byStatus.provisioning ?? 0, icon: 'ri-loader-4-line', variant: 'accent', link: '/solidserv/dashboard',
        label: plural(s?.byStatus.provisioning ?? 0, 'serveur en création', 'serveurs en création', 'server provisioning', 'servers provisioning') },
      { key: 'pending', count: this.pending(), icon: 'ri-time-line', variant: 'accent', link: '/prestations',
        label: plural(this.pending(), 'prestation en attente', 'prestations en attente', 'pending service', 'pending services') },
      { key: 'stock', count: this.outOfStock(), icon: 'ri-inbox-unarchive-line', variant: 'warning', link: '/solidserv/produits',
        label: plural(this.outOfStock(), 'produit en rupture', 'produits en rupture', 'product out of stock', 'products out of stock') },
    ];
    return items.filter(i => i.count > 0);
  });

  /** Au moins un aperçu possible : sinon on n'affiche que les accès rapides. */
  readonly hasWatch = computed(() =>
    this.canWebSites() || this.canServers() || this.canPrestations() || this.canProducts());

  ngOnInit() {
    this.load();
  }

  async load() {
    this.loading.set(true);
    // Chaque bloc est indépendant : un échec (ou un 403) ne bloque pas les autres.
    await Promise.allSettled([
      this.canAnalytics() && this.analytics.getStatsGlobal(this.analytics.range('7d')).then(r => r.success && this.traffic.set(r.data)),
      this.canServers() && this.servers.getStats().then(r => r.success && this.serverStats.set(r.data)),
      this.canWebSites() && Promise.all([this.webSites.getExpiring(30), this.webSites.getExpiringSsl(30)]).then(([d, s]) => {
        const domains = d.success ? d.data ?? [] : [];
        const ssl     = s.success ? s.data ?? [] : [];
        this.domainsToRenew.set(domains.length);
        this.sslToRenew.set(ssl.length);
        this.expiredCount.set(
          domains.filter(x => (x.daysUntilExpiry ?? 0) < 0).length + ssl.filter(x => (x.sslDaysUntilExpiry ?? 0) < 0).length,
        );
      }),
      this.canPrestations() && this.prestations.getAllPrestations().then(r => {
        const list = r.success ? r.data ?? [] : [];
        this.pending.set(list.filter(p => p.status === 'pending').length);
        this.activeValue.set(list.filter(p => p.status === 'active').reduce((sum, p) => sum + (p.price ?? 0), 0));
      }),
      this.canProducts() && this.products.getAll().then(r => {
        const list = r.success ? r.data ?? [] : [];
        this.outOfStock.set(list.filter(p => p.isActive && !p.inStock).length);
      }),
    ]);
    this.loading.set(false);
  }

  price(cents: number | null) { return formatPrice(cents, this.lang()); }
}
