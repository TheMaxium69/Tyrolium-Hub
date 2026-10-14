import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ITyroUiButtonGroupItem, ITyroUiSelectItem, TyroUiAlert, TyroUiBentoCard, TyroUiButton, TyroUiButtonGroup,
  TyroUiConfirmService, TyroUiLangService, TyroUiPageHeader, TyroUiSelect, TyroUiSkeleton, TyroUiSnackbarService,
  TyroUiTextField,
} from 'tyrolium-ui';
import { HubUser, hubUserName } from '../../../components/hub-user/hub-user';
import { ServerStatusChip, serverStatusIcon, serverStatusLabel } from '../../../components/server-status/server-status';
import { IApiResponse } from '../../../config/api';
import { ISolidServProduct, SolidServProductService } from '../../../services/solidserv-product.service';
import {
  IServer, IServerPayload, IServerType, SERVER_STATUSES, ServerStatus, SolidServServerService,
} from '../../../services/solidserv-server.service';
import { IUseritiumUser, UseritiumAdminService } from '../../../services/useritium-admin.service';
import { IWebSite, WebSiteService } from '../../../services/web-site.service';
import { WebSiteStatusChip } from '../../../components/web-site-badges/web-site-badges';
import { formatDateTime } from '../../../utils/format';

type OwnerMode = 'internal' | 'client';

interface IServerForm {
  typeId:      string;
  name:        string;
  alias:       string;
  description: string;
  location:    string;
  hostname:    string;
  project:     string;
  status:      ServerStatus;
  startedAt:   string;
  owner:       OwnerMode;
  productId:   string;
  userId:      string;
  clientName:  string;
}

/** Création (/solidserv/dashboard/nouveau) et fiche / modification (/solidserv/dashboard/:id) d'un serveur. */
@Component({
  selector: 'app-solidserv-server-form',
  imports: [
    TyroUiPageHeader, TyroUiBentoCard, TyroUiButton, TyroUiButtonGroup, TyroUiTextField, TyroUiSelect, TyroUiAlert,
    TyroUiSkeleton, HubUser, ServerStatusChip, WebSiteStatusChip,
  ],
  templateUrl: './server-form.html',
  styleUrl: './server-form.css',
})
export class SolidServServerForm {
  readonly lang    = inject(TyroUiLangService).lang;
  readonly service = inject(SolidServServerService);
  private readonly products = inject(SolidServProductService);
  private readonly users    = inject(UseritiumAdminService);
  readonly webSites         = inject(WebSiteService);
  private readonly route    = inject(ActivatedRoute);
  private readonly router   = inject(Router);
  private readonly snackbar = inject(TyroUiSnackbarService);
  private readonly confirm  = inject(TyroUiConfirmService);

  /** null : création. */
  readonly id = signal<number | null>(null);

  readonly loading   = signal(true);
  readonly notFound  = signal(false);
  readonly loadError = signal(false);
  readonly saving    = signal(false);
  readonly formError = signal<string | null>(null);
  readonly server    = signal<IServer | null>(null);
  readonly types     = signal<IServerType[]>([]);
  readonly catalog   = signal<ISolidServProduct[]>([]);
  readonly accounts  = signal<IUseritiumUser[]>([]);
  /** Sites hébergés (null : pas la permission de voir les sites). */
  readonly sites     = signal<IWebSite[] | null>(null);

  /** Signal miroir du type choisi, pour le préfixe affiché en direct. */
  readonly typeId = signal('');
  form: IServerForm = this.emptyForm();

  readonly isNew    = computed(() => this.id() === null);
  readonly readOnly = computed(() => !this.service.canServer(this.isNew() ? 'create' : 'update'));
  readonly type     = computed(() => this.types().find(t => String(t.id) === this.typeId()) ?? null);

  readonly typeItems = computed<ITyroUiSelectItem[]>(() =>
    this.types().map(t => ({ value: String(t.id), label: `${t.name} · ${t.namePrefix}…`, icon: 'ri-stack-line' })),
  );

  readonly statusItems = computed<ITyroUiSelectItem[]>(() =>
    SERVER_STATUSES.map(s => ({ value: s, label: serverStatusLabel(s, this.lang()), icon: serverStatusIcon(s) })),
  );

  readonly ownerItems = computed<ITyroUiButtonGroupItem[]>(() => [
    { value: 'internal', label: this.lang() === 'en' ? 'Internal' : 'Interne', icon: 'ri-building-line' },
    { value: 'client',   label: 'Client', icon: 'ri-user-star-line' },
  ]);

  readonly productItems = computed<ITyroUiSelectItem[]>(() => {
    const current = this.server()?.product?.id;
    return [
      { value: '', label: this.lang() === 'en' ? 'No product' : 'Aucun produit' },
      ...this.catalog()
        // Produits désactivés masqués, sauf celui déjà lié au serveur.
        .filter(p => p.isActive || p.id === current)
        .map(p => ({ value: String(p.id), label: `${p.displayName} · ${p.tagName}`, icon: 'ri-shopping-bag-3-line' })),
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
    this.server.set(null);
    try {
      const id = this.id();
      const canSites = id !== null && this.canViewSites();
      const [server, types, products, accounts, sites] = await Promise.all([
        id === null ? Promise.resolve(null) : this.service.getServer(id),
        this.service.getTypes(),
        this.service.canPickProduct() ? this.products.getAll() : Promise.resolve(null),
        this.service.canPickUser() ? this.users.getAllUsers() : Promise.resolve(null),
        canSites ? this.webSites.getByServer(id!) : Promise.resolve(null),
      ]);
      if (server?.code === 404) {
        this.notFound.set(true);
        return;
      }
      if (!types.success || (server && (!server.success || !server.data))) throw new Error();
      this.types.set(types.data ?? []);
      this.catalog.set(products?.success ? products.data ?? [] : []);
      this.accounts.set(accounts?.success ? accounts.data ?? [] : []);
      this.sites.set(sites?.success ? sites.data ?? [] : null);
      this.server.set(server?.data ?? null);
      this.setForm(server?.data ? this.toForm(server.data) : this.emptyForm());
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  back() {
    this.router.navigate(['/solidserv/dashboard']);
  }

  canViewSites() { return this.service.canViewWebSites(); }

  openSite(id: number) {
    this.router.navigate(['/websites', id]);
  }

  /** Changement de type : propose le nouveau préfixe si le nom était vide ou suivait l'ancien préfixe. */
  onTypeChange(value: string) {
    const previous = this.type();
    const next     = this.types().find(t => String(t.id) === value);
    this.form.typeId = value;
    this.typeId.set(value);
    if (!next) return;
    const name = this.form.name.trim();
    if (!name || (previous && name.startsWith(previous.namePrefix))) {
      const number = previous ? name.slice(previous.namePrefix.length) : '';
      this.form.name = next.namePrefix + (/^\d+$/.test(number) ? number : '');
    }
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
      const res = id === null ? await this.service.createServer(payload) : await this.service.updateServer(id, payload);
      if (!res.success || !res.data) {
        this.handleError(res);
        return;
      }
      this.snackbar.show({ type: 'success', message: id === null ? (en ? 'Server created.' : 'Serveur créé.') : (en ? 'Server updated.' : 'Serveur mis à jour.') });
      if (id === null) {
        this.router.navigate(['/solidserv/dashboard', res.data.id]);
      } else {
        this.server.set(res.data);
        this.setForm(this.toForm(res.data));
      }
    } catch {
      this.formError.set(en ? 'Unable to reach Tyrolium API.' : 'Impossible de contacter l\'API Tyrolium.');
    } finally {
      this.saving.set(false);
    }
  }

  async remove() {
    const server = this.server();
    if (!server) return;
    const en = this.lang() === 'en';
    const ok = await this.confirm.confirm({
      type:         'danger',
      icon:         'ri-delete-bin-line',
      title:        en ? `Delete ${server.name}?` : `Supprimer ${server.name} ?`,
      message:      (en
        ? 'The server will be removed from the fleet. To keep its history, prefer the "Decommissioned" status.'
        : 'Le serveur sera retiré du parc. Pour garder son historique, préférez le statut « Décommissionné ».')
        + this.detachWarning(en),
      confirmLabel: en ? 'Delete' : 'Supprimer',
      cancelLabel:  en ? 'Cancel' : 'Annuler',
    });
    if (!ok) return;
    try {
      const res = await this.service.deleteServer(server.id);
      if (!res.success) {
        this.handleError(res);
        return;
      }
      this.snackbar.show({ type: 'success', message: en ? 'Server deleted.' : 'Serveur supprimé.' });
      this.back();
    } catch {
      this.snackbar.show({ type: 'danger', message: en ? 'Unable to reach Tyrolium API.' : 'Impossible de contacter l\'API Tyrolium.' });
    }
  }

  date(iso: string | null) { return iso ? formatDateTime(iso, this.lang()) : '-'; }

  /** Les sites hébergés ne sont pas supprimés : ils sont simplement détachés. */
  private detachWarning(en: boolean): string {
    const n = this.sites()?.length ?? 0;
    if (!n) return '';
    return en
      ? ` ${n} hosted website${n > 1 ? 's' : ''} will be detached (not deleted).`
      : ` ${n} site${n > 1 ? 's' : ''} hébergé${n > 1 ? 's' : ''} ser${n > 1 ? 'ont' : 'a'} détaché${n > 1 ? 's' : ''} (pas supprimé${n > 1 ? 's' : ''}).`;
  }

  /* ─── Formulaire ⇄ API ───────────────────────────────── */

  private setForm(form: IServerForm) {
    this.form = form;
    this.typeId.set(form.typeId);
  }

  private emptyForm(): IServerForm {
    return {
      typeId: '', name: '', alias: '', description: '', location: '', hostname: '', project: '', status: 'active',
      startedAt: '', owner: 'internal', productId: '', userId: '', clientName: '',
    };
  }

  private toForm(s: IServer): IServerForm {
    return {
      typeId:      String(s.type.id),
      name:        s.name,
      alias:       s.alias ?? '',
      description: s.description ?? '',
      location:    s.location ?? '',
      hostname:    s.hostname ?? '',
      project:     s.project ?? '',
      status:      s.status,
      startedAt:   s.startedAt?.slice(0, 10) ?? '',
      // Un serveur historique peut avoir un produit sans client : on le range côté client.
      owner:       s.hasClient || s.product ? 'client' : 'internal',
      productId:   s.product ? String(s.product.id) : '',
      userId:      s.user?.id !== undefined ? String(s.user.id) : '',
      clientName:  s.clientName ?? '',
    };
  }

  /** Payload complet ; un serveur interne n'a ni produit, ni compte, ni nom de client. */
  private toPayload(): IServerPayload | string {
    const en   = this.lang() === 'en';
    const f    = this.form;
    const type = this.type();
    const name = f.name.trim().toLowerCase();

    if (!type) return en ? 'Choose the server type.' : 'Choisissez le type de serveur.';
    if (!this.service.isValidName(name, type)) {
      return en
        ? `The name must be "${type.namePrefix}" followed by a number (e.g. ${type.namePrefix}201).`
        : `Le nom doit être « ${type.namePrefix} » suivi d'un numéro (ex. ${type.namePrefix}201).`;
    }
    const hostname = f.hostname.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const isClient = f.owner === 'client';

    return {
      typeId:      type.id,
      name,
      alias:       f.alias.trim() || null,
      description: f.description.trim() || null,
      location:    f.location.trim() || null,
      hostname:    hostname || null,
      project:     f.project.trim() || null,
      status:      f.status,
      startedAt:   f.startedAt || null,
      productId:   isClient && f.productId ? Number(f.productId) : null,
      userId:      isClient && f.userId ? Number(f.userId) : null,
      clientName:  isClient ? f.clientName.trim() || null : null,
    };
  }

  /** 403 : rien d'affiché (droits relus). Sinon message de l'API. */
  private handleError(res: IApiResponse<unknown>) {
    if (res.code === 403) return;
    this.formError.set(res.errors?.[0]?.message ?? res.message);
  }
}
