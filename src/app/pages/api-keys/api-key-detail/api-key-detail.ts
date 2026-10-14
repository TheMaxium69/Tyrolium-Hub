import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  TyroUiAlert, TyroUiBentoCard, TyroUiButton, TyroUiConfirmService, TyroUiLangService, TyroUiPageHeader,
  TyroUiSkeleton, TyroUiSnackbarService,
} from 'tyrolium-ui';
import { ApiKeyStatusChip } from '../../../components/api-key-status/api-key-status';
import { HubUser } from '../../../components/hub-user/hub-user';
import { PermissionGrants } from '../../../components/permission-grants/permission-grants';
import { IApiResponse } from '../../../config/api';
import { ApiKeyService, IApiKey } from '../../../services/api-key.service';
import { IPermission, IPermissionGrant, PermissionService } from '../../../services/permission.service';
import { formatDateTime } from '../../../utils/format';

/** Fiche d'une clé API : permissions et révocation. Réservé au owner. */
@Component({
  selector: 'app-api-key-detail',
  imports: [
    TyroUiPageHeader, TyroUiBentoCard, TyroUiButton, TyroUiAlert, TyroUiSkeleton, ApiKeyStatusChip, HubUser,
    PermissionGrants,
  ],
  templateUrl: './api-key-detail.html',
  styleUrl: './api-key-detail.css',
})
export class ApiKeyDetail {
  readonly lang    = inject(TyroUiLangService).lang;
  readonly service = inject(ApiKeyService);
  private readonly permissions = inject(PermissionService);
  private readonly route       = inject(ActivatedRoute);
  private readonly router      = inject(Router);
  private readonly snackbar    = inject(TyroUiSnackbarService);
  private readonly confirm     = inject(TyroUiConfirmService);

  private id = 0;

  readonly loading   = signal(true);
  readonly notFound  = signal(false);
  readonly loadError = signal(false);
  readonly busy      = signal(false);
  readonly key       = signal<IApiKey | null>(null);
  readonly catalog   = signal<IPermission[]>([]);

  readonly status = computed(() => { const k = this.key(); return k ? this.service.status(k) : null; });
  /** Une clé révoquée ou expirée n'est plus modifiable. */
  readonly active = computed(() => this.status() === 'active');

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.id = Number(params.get('id'));
      this.load();
    });
  }

  async load(silent = false) {
    if (!silent) {
      this.loading.set(true);
      this.key.set(null);
    }
    this.loadError.set(false);
    this.notFound.set(false);
    try {
      const [key, catalog] = await Promise.all([
        this.service.get(this.id),
        this.catalog().length ? Promise.resolve(null) : this.permissions.getCatalog(),
      ]);
      if (key.code === 404) {
        this.notFound.set(true);
        return;
      }
      if (!key.success || !key.data) throw new Error();
      this.key.set(key.data);
      if (catalog?.success) this.catalog.set(catalog.data ?? []);
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  back() {
    this.router.navigate(['/cles-api']);
  }

  async grant(permission: IPermission) {
    const en = this.lang() === 'en';
    if (await this.run(() => this.service.grant(this.id, permission.id), en ? `${permission.label} granted.` : `${permission.label} accordée.`)) {
      await this.load(true);
    }
  }

  async remove(grant: IPermissionGrant) {
    const en = this.lang() === 'en';
    const ok = await this.confirm.confirm({
      type:         'danger',
      icon:         'ri-key-line',
      title:        en ? 'Remove this permission?' : 'Retirer cette permission ?',
      message:      en
        ? `${grant.permission?.label} will be removed from the key ${this.key()?.label}. Requests needing it will be refused immediately.`
        : `${grant.permission?.label} sera retirée de la clé ${this.key()?.label}. Les requêtes qui en ont besoin seront refusées immédiatement.`,
      confirmLabel: en ? 'Remove' : 'Retirer',
      cancelLabel:  en ? 'Cancel' : 'Annuler',
    });
    if (!ok) return;
    if (await this.run(() => this.service.removePermission(grant.id), en ? 'Permission removed.' : 'Permission retirée.')) {
      await this.load(true);
    }
  }

  async revoke() {
    const key = this.key();
    if (!key) return;
    const en = this.lang() === 'en';
    const ok = await this.confirm.confirm({
      type:         'danger',
      icon:         'ri-forbid-line',
      title:        en ? `Revoke ${key.label}?` : `Révoquer ${key.label} ?`,
      message:      en
        ? 'The key stops working immediately. This cannot be undone: the system using it will need a new key.'
        : 'La clé cesse de fonctionner immédiatement. C\'est irréversible : le système qui l\'utilise aura besoin d\'une nouvelle clé.',
      confirmLabel: en ? 'Revoke' : 'Révoquer',
      cancelLabel:  en ? 'Cancel' : 'Annuler',
    });
    if (!ok) return;
    if (await this.run(() => this.service.revoke(key.id), en ? 'Key revoked.' : 'Clé révoquée.')) {
      await this.load(true);
    }
  }

  date(iso: string | null) { return iso ? formatDateTime(iso, this.lang()) : (this.lang() === 'en' ? 'Never' : 'Jamais'); }

  private async run(action: () => Promise<IApiResponse<unknown>>, success: string): Promise<boolean> {
    this.busy.set(true);
    try {
      const res = await action();
      if (!res.success) {
        if (res.code !== 403) this.snackbar.show({ type: 'danger', message: res.errors?.[0]?.message ?? res.message });
        return false;
      }
      this.snackbar.show({ type: 'success', message: success });
      return true;
    } catch {
      this.snackbar.show({ type: 'danger', message: this.lang() === 'en' ? 'Unable to reach Tyrolium API.' : 'Impossible de contacter l\'API Tyrolium.' });
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
