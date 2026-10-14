import { Component, computed, inject, input, output, signal } from '@angular/core';
import {
  ITyroUiSelectItem, TyroUiButton, TyroUiChip, TyroUiLangService, TyroUiSelect,
} from 'tyrolium-ui';
import { IPermission, IPermissionGrant } from '../../services/permission.service';
import { formatDate } from '../../utils/format';
import { HubUser } from '../hub-user/hub-user';

/**
 * Permissions accordées (à un compte ou à une clé API) + sélecteur d'ajout.
 * Purement présentationnel : le parent appelle l'API sur (granted) / (removed).
 */
@Component({
  selector: 'app-permission-grants',
  imports: [TyroUiSelect, TyroUiButton, TyroUiChip, HubUser],
  templateUrl: './permission-grants.html',
  styleUrl: './permission-grants.css',
})
export class PermissionGrants {
  readonly lang = inject(TyroUiLangService).lang;

  readonly grants   = input<IPermissionGrant[]>([]);
  readonly catalog  = input<IPermission[]>([]);
  readonly editable = input(false);
  readonly busy     = input(false);

  readonly granted = output<IPermission>();
  readonly removed = output<IPermissionGrant>();

  readonly selectedId = signal('');

  /** Catalogue sans les permissions déjà accordées. */
  readonly available = computed(() => {
    const owned = new Set(this.grants().map(g => g.permission?.id));
    return this.catalog().filter(p => !owned.has(p.id));
  });

  readonly items = computed<ITyroUiSelectItem[]>(() =>
    this.available().map(p => ({
      value: String(p.id),
      label: `${p.label} · ${p.name}`,
      icon:  p.impliedPermissions?.length ? 'ri-umbrella-line' : 'ri-key-line',
    })),
  );

  readonly selected = computed(() => this.available().find(p => String(p.id) === this.selectedId()) ?? null);

  /** Retrouve les permissions impliquées depuis le catalogue (plus complet que l'attribution). */
  implied(grant: IPermissionGrant) {
    const id = grant.permission?.id;
    return this.catalog().find(p => p.id === id)?.impliedPermissions ?? grant.permission?.impliedPermissions ?? [];
  }

  submit() {
    const permission = this.selected();
    if (!permission || this.busy()) return;
    this.granted.emit(permission);
    this.selectedId.set('');
  }

  date(iso: string) { return formatDate(iso, this.lang()); }
}
