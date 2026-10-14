import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  TyroUiAlert, TyroUiAvatar, TyroUiBentoCard, TyroUiButton, TyroUiChip, TyroUiConfirmService, TyroUiLangService,
  TyroUiSkeleton, TyroUiSnackbarService,
} from 'tyrolium-ui';
import { AccessLevel } from '../../../components/access-level/access-level';
import { hubUserName } from '../../../components/hub-user/hub-user';
import { PermissionGrants } from '../../../components/permission-grants/permission-grants';
import { apiAsset, IApiResponse } from '../../../config/api';
import { IPermission, IPermissionGrant, PermissionService } from '../../../services/permission.service';
import { UserCardService } from '../../../services/user-card.service';
import { IUseritiumUser, UseritiumAdminService } from '../../../services/useritium-admin.service';

/** Permissions et accès interne d'un membre du personnel. Réservé au owner ; un owner n'est jamais modifiable. */
@Component({
  selector: 'app-staff-detail',
  imports: [
    TyroUiBentoCard, TyroUiButton, TyroUiChip, TyroUiAlert, TyroUiSkeleton, TyroUiAvatar, AccessLevel,
    PermissionGrants,
  ],
  templateUrl: './staff-detail.html',
  styleUrl: './staff-detail.css',
})
export class StaffDetail {
  readonly lang = inject(TyroUiLangService).lang;
  private readonly permissions = inject(PermissionService);
  private readonly users       = inject(UseritiumAdminService);
  private readonly cards       = inject(UserCardService);
  private readonly route       = inject(ActivatedRoute);
  private readonly router      = inject(Router);
  private readonly snackbar    = inject(TyroUiSnackbarService);
  private readonly confirm     = inject(TyroUiConfirmService);

  private id = 0;

  readonly loading   = signal(true);
  readonly notFound  = signal(false);
  readonly loadError = signal(false);
  readonly busy      = signal(false);
  readonly user      = signal<IUseritiumUser | null>(null);
  readonly catalog   = signal<IPermission[]>([]);

  readonly name     = computed(() => hubUserName(this.user()));
  readonly avatar   = computed(() => apiAsset(this.user()?.pp));
  readonly isOwner  = computed(() => this.user()?.accessLevel === 'owner');
  readonly isInterne = computed(() => this.user()?.accessLevel === 'interne');
  readonly grants   = computed<IPermissionGrant[]>(() => (this.user()?.permissions ?? []) as IPermissionGrant[]);

  /** Droits effectifs (roles déjà dépliés par l'API, parapluies compris), avec leur libellé du catalogue. */
  readonly effective = computed(() => {
    const byRole = new Map(this.catalog().map(p => [this.permissions.roleOf(p.name), p]));
    return (this.user()?.roles ?? [])
      .filter(r => r.startsWith('PERMS_'))
      .map(role => ({ role, label: byRole.get(role)?.label ?? role }));
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.id = Number(params.get('id'));
      this.load();
    });
  }

  async load(silent = false) {
    if (!silent) {
      this.loading.set(true);
      this.user.set(null);
    }
    this.loadError.set(false);
    this.notFound.set(false);
    try {
      const [user, catalog] = await Promise.all([
        this.users.getUser(this.id),
        this.catalog().length ? Promise.resolve(null) : this.permissions.getCatalog(),
      ]);
      if (user.code === 404) {
        this.notFound.set(true);
        return;
      }
      if (!user.success || !user.data) throw new Error();
      this.user.set(user.data);
      if (catalog?.success) this.catalog.set(catalog.data ?? []);
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  back() {
    this.router.navigate(['/permissions']);
  }

  /** Effet immédiat, sans reconnexion. */
  async grant(permission: IPermission) {
    const user = this.user();
    if (!user) return;
    const en = this.lang() === 'en';
    const ok = await this.run(
      () => this.permissions.grant(user.id, permission.id),
      en ? `${permission.label} granted.` : `${permission.label} accordée.`,
    );
    if (ok) await this.load(true);
  }

  async remove(grant: IPermissionGrant) {
    const user = this.user();
    if (!user) return;
    const en = this.lang() === 'en';
    const confirmed = await this.confirm.confirm({
      type:         'danger',
      icon:         'ri-key-line',
      title:        en ? 'Remove this permission?' : 'Retirer cette permission ?',
      message:      en
        ? `${grant.permission?.label} will be removed from ${this.name()}. All their sessions will be closed: they will have to sign in again.`
        : `${grant.permission?.label} sera retirée à ${this.name()}. Toutes ses sessions seront fermées : il devra se reconnecter.`,
      confirmLabel: en ? 'Remove' : 'Retirer',
      cancelLabel:  en ? 'Cancel' : 'Annuler',
    });
    if (!confirmed) return;
    const ok = await this.run(() => this.permissions.revoke(grant.id), en ? 'Permission removed.' : 'Permission retirée.');
    if (ok) await this.load(true);
  }

  async revokeInterne() {
    const user = this.user();
    if (!user) return;
    const en = this.lang() === 'en';
    const confirmed = await this.confirm.confirm({
      type:         'danger',
      icon:         'ri-shield-cross-line',
      title:        en ? 'Remove internal access?' : 'Retirer l\'accès interne ?',
      message:      en
        ? `${this.name()} will lose access to the Hub and all their sessions will be closed. Their permissions are kept and will come back if they become internal again.`
        : `${this.name()} perdra l'accès au Hub et toutes ses sessions seront fermées. Ses permissions sont conservées et reviendront s'il redevient interne.`,
      confirmLabel: en ? 'Remove access' : 'Retirer l\'accès',
      cancelLabel:  en ? 'Cancel' : 'Annuler',
    });
    if (!confirmed) return;
    const ok = await this.run(() => this.permissions.revokeInterne(user.id), en ? 'Internal access removed.' : 'Accès interne retiré.');
    if (ok) await this.load(true);
  }

  async grantInterne() {
    const user = this.user();
    if (!user) return;
    const en = this.lang() === 'en';
    const ok = await this.run(() => this.permissions.grantInterne(user.id), en ? 'Internal access restored.' : 'Accès interne rétabli.');
    if (ok) await this.load(true);
  }

  /** 403 : rien d'affiché (droits relus). Sinon message de l'API en snackbar. */
  private async run(action: () => Promise<IApiResponse<unknown>>, success: string): Promise<boolean> {
    this.busy.set(true);
    try {
      const res = await action();
      if (!res.success) {
        if (res.code !== 403) this.snackbar.show({ type: 'danger', message: res.errors?.[0]?.message ?? res.message });
        return false;
      }
      this.snackbar.show({ type: 'success', message: success });
      this.cards.invalidate(this.id);
      return true;
    } catch {
      this.snackbar.show({ type: 'danger', message: this.lang() === 'en' ? 'Unable to reach Tyrolium API.' : 'Impossible de contacter l\'API Tyrolium.' });
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
