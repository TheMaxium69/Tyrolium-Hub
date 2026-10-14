import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ITyroUiDataTableColumn, ITyroUiSelectItem, TyroUiAlert, TyroUiBentoCard, TyroUiButton, TyroUiConfirmService,
  TyroUiDataTable, TyroUiDataTableColDef, TyroUiLangService, TyroUiPageHeader, TyroUiSelect, TyroUiSkeleton,
  TyroUiSnackbarService,
} from 'tyrolium-ui';
import { AccessLevel } from '../../../components/access-level/access-level';
import { HubUser, hubUserName } from '../../../components/hub-user/hub-user';
import { PermissionService } from '../../../services/permission.service';
import { IUseritiumUser, UseritiumAdminService } from '../../../services/useritium-admin.service';

/** Personnel (interne + owner) et accès interne. Réservé au owner. */
@Component({
  selector: 'app-staff-list',
  imports: [
    TyroUiPageHeader, TyroUiBentoCard, TyroUiDataTable, TyroUiDataTableColDef, TyroUiButton, TyroUiSelect,
    TyroUiAlert, TyroUiSkeleton, HubUser, AccessLevel,
  ],
  templateUrl: './staff-list.html',
  styleUrl: './staff-list.css',
})
export class StaffList implements OnInit {
  readonly lang = inject(TyroUiLangService).lang;
  private readonly permissions = inject(PermissionService);
  private readonly users       = inject(UseritiumAdminService);
  private readonly router      = inject(Router);
  private readonly snackbar    = inject(TyroUiSnackbarService);
  private readonly confirm     = inject(TyroUiConfirmService);

  readonly loading   = signal(true);
  readonly loadError = signal(false);
  readonly staff     = signal<IUseritiumUser[]>([]);

  /* ─── Passer un compte en interne ────────────────────── */
  readonly addOpen      = signal(false);
  readonly addLoading   = signal(false);
  readonly publicUsers  = signal<IUseritiumUser[]>([]);
  readonly candidateId  = signal('');
  readonly busy         = signal(false);

  readonly candidateItems = computed<ITyroUiSelectItem[]>(() =>
    this.publicUsers()
      .filter(u => !u.bannedAt)
      .map(u => ({ value: String(u.id), label: `${hubUserName(u)} (@${u.username}) · ${this.users.defaultEmail(u)}`, icon: 'ri-user-line' })),
  );

  readonly columns: ITyroUiDataTableColumn[] = [
    { key: 'username',    label: 'Membre',        labelEn: 'Member',      sortable: true },
    { key: 'accessLevel', label: 'Accès',         labelEn: 'Access',      sortable: true, width: '190px' },
    { key: 'perms',       label: 'Droits effectifs', labelEn: 'Effective rights', sortable: true, width: '160px', align: 'right' },
    { key: 'actions',     label: '',                                       width: '120px', align: 'right' },
  ];

  readonly rows = computed(() => this.staff().map(u => {
    // roles est déjà déplié par l'API (parapluies inclus) : on compte les PERMS_*.
    const perms = (u.roles ?? []).filter(r => r.startsWith('PERMS_')).length;
    return {
      id:          u.id,
      username:    `${hubUserName(u)} @${u.username}`,
      accessLevel: u.accessLevel,
      perms:       String(perms).padStart(4, '0'),
      permsCount:  perms,
      user:        u,
    };
  }));

  ngOnInit() {
    this.load();
  }

  async load() {
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const res = await this.permissions.getStaff();
      if (!res.success) throw new Error();
      this.staff.set(res.data);
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  open(id: number) {
    this.router.navigate(['/permissions', id]);
  }

  async toggleAdd() {
    this.addOpen.update(v => !v);
    this.candidateId.set('');
    if (this.addOpen() && !this.publicUsers().length) {
      this.addLoading.set(true);
      try {
        const res = await this.permissions.getPublicUsers();
        this.publicUsers.set(res.success ? res.data ?? [] : []);
      } finally {
        this.addLoading.set(false);
      }
    }
  }

  async promote() {
    const user = this.publicUsers().find(u => String(u.id) === this.candidateId());
    if (!user || this.busy()) return;

    const en = this.lang() === 'en';
    const ok = await this.confirm.confirm({
      icon:         'ri-shield-user-line',
      title:        en ? 'Give internal access?' : 'Donner l\'accès interne ?',
      message:      en
        ? `${hubUserName(user)} will be able to sign in to the Hub. They will only see what their permissions allow.`
        : `${hubUserName(user)} pourra se connecter au Hub. Il ne verra que ce que ses permissions autorisent.`,
      confirmLabel: en ? 'Give access' : 'Donner l\'accès',
      cancelLabel:  en ? 'Cancel' : 'Annuler',
    });
    if (!ok) return;

    this.busy.set(true);
    try {
      const res = await this.permissions.grantInterne(user.id);
      if (!res.success) {
        if (res.code !== 403) this.snackbar.show({ type: 'danger', message: res.errors?.[0]?.message ?? res.message });
        return;
      }
      this.snackbar.show({ type: 'success', message: en ? `${hubUserName(user)} is now internal.` : `${hubUserName(user)} est maintenant interne.` });
      this.publicUsers.update(list => list.filter(u => u.id !== user.id));
      this.addOpen.set(false);
      this.router.navigate(['/permissions', user.id]);
    } catch {
      this.snackbar.show({ type: 'danger', message: en ? 'Unable to reach Tyrolium API.' : 'Impossible de contacter l\'API Tyrolium.' });
    } finally {
      this.busy.set(false);
    }
  }
}
