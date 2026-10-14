import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ITyroUiButtonGroupItem, ITyroUiSelectItem, TyroUiAlert, TyroUiBentoCard, TyroUiButton, TyroUiButtonGroup,
  TyroUiConfirmService, TyroUiLangService, TyroUiPageHeader, TyroUiSelect, TyroUiSkeleton, TyroUiSnackbarService,
  TyroUiSwitch, TyroUiTextField,
} from 'tyrolium-ui';
import { GitLink } from '../../../components/git-link/git-link';
import { ServerLink } from '../../../components/server-link/server-link';
import { HubUser, hubUserName } from '../../../components/hub-user/hub-user';
import {
  DomainExpiry, WebSiteOwner, WebSiteStatusChip, webSiteStatusIcon, webSiteStatusLabel,
} from '../../../components/web-site-badges/web-site-badges';
import { IApiResponse } from '../../../config/api';
import { IPrestation, PrestationService } from '../../../services/prestation.service';
import { IServer, SolidServServerService } from '../../../services/solidserv-server.service';
import { IUseritiumUser, UseritiumAdminService } from '../../../services/useritium-admin.service';
import {
  IWebSite, IWebSitePayload, WEB_SITE_FILIALES, WEB_SITE_STATUSES, WebSiteFiliale, WebSiteOwnerType, WebSiteService,
  WebSiteStatus,
} from '../../../services/web-site.service';
import { formatDateTime, isGitRepository } from '../../../utils/format';

interface IWebSiteForm {
  domainName:      string;
  name:            string;
  description:     string;
  ownerType:       WebSiteOwnerType;
  filiale:         string;
  prestationId:    string;
  userId:          string;
  clientName:      string;
  status:          WebSiteStatus;
  registrar:       string;
  domainExpiresAt: string;
  autoRenew:       boolean;
  sslExpiresAt:    string;
  sslAutoRenew:    boolean;
  sslProvider:     string;
  gitRepository:   string;
  serverId:        string;
}

/** Ajout (/websites/nouveau) et fiche / modification (/websites/:id) d'un site du registre. */
@Component({
  selector: 'app-website-form',
  imports: [
    TyroUiPageHeader, TyroUiBentoCard, TyroUiButton, TyroUiButtonGroup, TyroUiTextField, TyroUiSelect, TyroUiSwitch,
    TyroUiAlert, TyroUiSkeleton, HubUser, GitLink, ServerLink, WebSiteStatusChip, WebSiteOwner, DomainExpiry,
  ],
  templateUrl: './website-form.html',
  styleUrl: './website-form.css',
})
export class WebsiteForm {
  readonly lang    = inject(TyroUiLangService).lang;
  readonly service = inject(WebSiteService);
  private readonly prestationService = inject(PrestationService);
  private readonly users             = inject(UseritiumAdminService);
  private readonly serverService     = inject(SolidServServerService);
  private readonly route             = inject(ActivatedRoute);
  private readonly router            = inject(Router);
  private readonly snackbar          = inject(TyroUiSnackbarService);
  private readonly confirm           = inject(TyroUiConfirmService);

  /** null : ajout. */
  readonly id = signal<number | null>(null);

  readonly loading     = signal(true);
  readonly notFound    = signal(false);
  readonly loadError   = signal(false);
  readonly saving      = signal(false);
  readonly formError   = signal<string | null>(null);
  readonly site        = signal<IWebSite | null>(null);
  readonly prestations = signal<IPrestation[]>([]);
  readonly accounts    = signal<IUseritiumUser[]>([]);
  readonly servers     = signal<IServer[]>([]);

  form: IWebSiteForm = this.emptyForm();

  readonly isNew    = computed(() => this.id() === null);
  readonly readOnly = computed(() => !this.service.can(this.isNew() ? 'create' : 'update'));

  readonly ownerItems = computed<ITyroUiButtonGroupItem[]>(() => [
    { value: 'filiale', label: this.lang() === 'en' ? 'Subsidiary' : 'Filiale', icon: 'ri-building-line' },
    { value: 'client',  label: 'Client', icon: 'ri-user-star-line' },
  ]);

  readonly filialeItems: ITyroUiSelectItem[] = WEB_SITE_FILIALES.map(f => ({ value: f.value, label: f.label, icon: 'ri-building-line' }));

  readonly statusItems = computed<ITyroUiSelectItem[]>(() =>
    WEB_SITE_STATUSES.map(s => ({ value: s, label: webSiteStatusLabel(s, this.lang()), icon: webSiteStatusIcon(s) })),
  );

  readonly prestationItems = computed<ITyroUiSelectItem[]>(() => [
    { value: '', label: this.lang() === 'en' ? 'No service' : 'Aucune prestation' },
    ...this.prestations().map(p => ({
      value: String(p.id),
      label: `#${p.id} · ${p.offre?.displayName ?? '-'} · ${this.prestationService.clientLabel(p)}`,
      icon:  'ri-briefcase-4-line',
    })),
  ]);

  readonly serverItems = computed<ITyroUiSelectItem[]>(() => {
    const current = this.site()?.server?.id;
    return [
      { value: '', label: this.lang() === 'en' ? 'Not linked' : 'Non rattaché' },
      ...this.servers()
        // Serveurs décommissionnés masqués, sauf celui déjà rattaché.
        .filter(s => s.status !== 'decommissioned' || s.id === current)
        .map(s => ({
          value: String(s.id),
          label: `${s.name}${s.alias ? ' · ' + s.alias : ''} · ${s.type.name}${s.hostname ? ' · ' + s.hostname : ''}`,
          icon:  'ri-server-line',
        })),
    ];
  });

  readonly accountItems = computed<ITyroUiSelectItem[]>(() => [
    { value: '', label: this.lang() === 'en' ? 'No account' : 'Aucun compte' },
    ...this.accounts().map(u => ({ value: String(u.id), label: `${hubUserName(u)} (@${u.username})`, icon: 'ri-user-line' })),
  ]);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const raw = params.get('id');
      this.id.set(raw === 'nouveau' ? null : Number(raw));
      this.load();
    });
  }

  async load() {
    this.loading.set(true);
    this.loadError.set(false);
    this.notFound.set(false);
    this.formError.set(null);
    this.site.set(null);
    try {
      const id = this.id();
      const [site, prestations, accounts, servers] = await Promise.all([
        id === null ? Promise.resolve(null) : this.service.get(id),
        this.service.canPickPrestation() ? this.prestationService.getAllPrestations() : Promise.resolve(null),
        this.service.canPickUser() ? this.users.getAllUsers() : Promise.resolve(null),
        this.service.canViewServers() ? this.serverService.getServers() : Promise.resolve(null),
      ]);
      if (site?.code === 404) {
        this.notFound.set(true);
        return;
      }
      if (site && (!site.success || !site.data)) throw new Error();
      this.prestations.set(prestations?.success ? prestations.data ?? [] : []);
      this.accounts.set(accounts?.success ? accounts.data ?? [] : []);
      this.servers.set(servers?.success ? servers.data ?? [] : []);
      this.site.set(site?.data ?? null);
      this.form = site?.data ? this.toForm(site.data) : this.emptyForm();
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  back() {
    this.router.navigate(['/websites']);
  }

  async save(e?: Event) {
    e?.preventDefault();
    if (this.saving() || this.readOnly()) return;

    const payload = this.toPayload();
    if (typeof payload === 'string') {
      this.formError.set(payload);
      return;
    }

    const en = this.lang() === 'en';
    const id = this.id();
    this.saving.set(true);
    this.formError.set(null);
    try {
      const res = id === null ? await this.service.create(payload) : await this.service.update(id, payload);
      if (!res.success || !res.data) {
        this.handleError(res);
        return;
      }
      this.snackbar.show({ type: 'success', message: id === null ? (en ? 'Website added.' : 'Site ajouté.') : (en ? 'Website updated.' : 'Site mis à jour.') });
      if (id === null) {
        this.router.navigate(['/websites', res.data.id]);
      } else {
        this.site.set(res.data);
        this.form = this.toForm(res.data);
      }
    } catch {
      this.formError.set(en ? 'Unable to reach Tyrolium API.' : 'Impossible de contacter l\'API Tyrolium.');
    } finally {
      this.saving.set(false);
    }
  }

  async remove() {
    const site = this.site();
    if (!site) return;
    const en = this.lang() === 'en';
    const ok = await this.confirm.confirm({
      type:         'danger',
      icon:         'ri-delete-bin-line',
      title:        en ? 'Delete this website?' : 'Supprimer ce site ?',
      message:      en
        ? `${site.domainName} will be removed from the registry. Prefer the "Archived" status to keep its history.`
        : `${site.domainName} sera retiré du registre. Préférez le statut « Archivé » pour garder son historique.`,
      confirmLabel: en ? 'Delete' : 'Supprimer',
      cancelLabel:  en ? 'Cancel' : 'Annuler',
    });
    if (!ok) return;
    try {
      const res = await this.service.delete(site.id);
      if (!res.success) {
        this.handleError(res);
        return;
      }
      this.snackbar.show({ type: 'success', message: en ? 'Website deleted.' : 'Site supprimé.' });
      this.back();
    } catch {
      this.snackbar.show({ type: 'danger', message: en ? 'Unable to reach Tyrolium API.' : 'Impossible de contacter l\'API Tyrolium.' });
    }
  }

  date(iso: string | null) { return iso ? formatDateTime(iso, this.lang()) : '-'; }

  /* ─── Formulaire ⇄ API ───────────────────────────────── */

  private emptyForm(): IWebSiteForm {
    return {
      domainName: '', name: '', description: '', ownerType: 'filiale', filiale: '', prestationId: '', userId: '',
      clientName: '', status: 'active', registrar: '', domainExpiresAt: '', autoRenew: false,
      sslExpiresAt: '', sslAutoRenew: false, sslProvider: '', gitRepository: '', serverId: '',
    };
  }

  private toForm(s: IWebSite): IWebSiteForm {
    return {
      domainName:      s.domainName,
      name:            s.name,
      description:     s.description ?? '',
      ownerType:       s.ownerType,
      filiale:         s.filiale ?? '',
      prestationId:    s.prestation ? String(s.prestation.id) : '',
      userId:          s.user?.id !== undefined ? String(s.user.id) : '',
      clientName:      s.clientName ?? '',
      status:          s.status,
      registrar:       s.registrar ?? '',
      domainExpiresAt: s.domainExpiresAt ?? '',
      autoRenew:       s.autoRenew,
      sslExpiresAt:    s.sslExpiresAt ?? '',
      sslAutoRenew:    s.sslAutoRenew,
      sslProvider:     s.sslProvider ?? '',
      gitRepository:   s.gitRepository ?? '',
      serverId:        s.server ? String(s.server.id) : '',
    };
  }

  /**
   * Payload complet (les clés absentes ne seraient pas modifiées) : les champs de
   * l'autre type de propriétaire partent à null, comme l'exige l'API.
   */
  private toPayload(): IWebSitePayload | string {
    const en = this.lang() === 'en';
    const f  = this.form;
    const domain = f.domainName.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    if (!domain) return en ? 'The domain name is required.' : 'Le nom de domaine est obligatoire.';
    if (!f.name.trim()) return en ? 'The website name is required.' : 'Le nom du site est obligatoire.';

    const isFiliale = f.ownerType === 'filiale';
    const prestationId = !isFiliale && f.prestationId ? Number(f.prestationId) : null;
    const userId       = !isFiliale && f.userId ? Number(f.userId) : null;
    const clientName   = !isFiliale ? f.clientName.trim() || null : null;

    if (isFiliale && !f.filiale) return en ? 'Choose the subsidiary.' : 'Choisissez la filiale.';
    if (!isFiliale && prestationId === null && userId === null && !clientName) {
      return en
        ? 'A client website needs at least a service, an account or a client name.'
        : 'Un site client a besoin d\'au moins une prestation, un compte ou un nom de client.';
    }

    const gitRepository = f.gitRepository.trim() || null;
    if (gitRepository && !isGitRepository(gitRepository)) {
      return en
        ? 'Git repository: https://…, ssh://… or git@host:path.'
        : 'Dépôt git : https://…, ssh://… ou git@hote:chemin.';
    }

    return {
      domainName:      domain,
      name:            f.name.trim(),
      description:     f.description.trim() || null,
      ownerType:       f.ownerType,
      filiale:         isFiliale ? f.filiale as WebSiteFiliale : null,
      prestationId,
      userId,
      clientName,
      status:          f.status,
      registrar:       f.registrar.trim() || null,
      domainExpiresAt: f.domainExpiresAt || null,
      autoRenew:       f.autoRenew,
      sslExpiresAt:    f.sslExpiresAt || null,
      sslAutoRenew:    f.sslAutoRenew,
      sslProvider:     f.sslProvider.trim() || null,
      gitRepository,
      // Sans accès au parc, on ne peut pas choisir : le rattachement actuel est conservé.
      serverId:        this.service.canViewServers()
        ? (f.serverId ? Number(f.serverId) : null)
        : (this.site()?.server?.id ?? null),
    };
  }

  /** 403 : rien d'affiché (droits relus). Sinon message de l'API (champ fautif pour un 422). */
  private handleError(res: IApiResponse<unknown>) {
    if (res.code === 403) return;
    this.formError.set(res.errors?.[0]?.message ?? res.message);
  }
}
