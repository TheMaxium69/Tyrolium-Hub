import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ITyroUiDataTableColumn, TyroUiAlert, TyroUiBentoCard, TyroUiButton, TyroUiDataTable, TyroUiDataTableColDef,
  TyroUiLangService, TyroUiPageHeader, TyroUiSkeleton,
} from 'tyrolium-ui';
import { AccessLevel } from '../../../components/access-level/access-level';
import { HubUser, hubUserName } from '../../../components/hub-user/hub-user';
import { IUseritiumUser, UseritiumAdminService } from '../../../services/useritium-admin.service';
import { formatDate } from '../../../utils/format';

@Component({
  selector: 'app-users-list',
  imports: [
    TyroUiPageHeader, TyroUiBentoCard, TyroUiDataTable, TyroUiDataTableColDef, TyroUiButton, TyroUiAlert,
    TyroUiSkeleton, HubUser, AccessLevel,
  ],
  templateUrl: './users-list.html',
  styleUrl: './users-list.css',
})
export class UsersList implements OnInit {
  readonly lang  = inject(TyroUiLangService).lang;
  private readonly admin  = inject(UseritiumAdminService);
  private readonly router = inject(Router);

  readonly loading   = signal(true);
  readonly loadError = signal(false);
  readonly users     = signal<IUseritiumUser[]>([]);

  readonly counts = computed(() => {
    const users = this.users();
    return {
      total:   users.length,
      interne: users.filter(u => u.accessLevel !== 'user').length,
      banned:  users.filter(u => !!u.bannedAt).length,
    };
  });

  readonly columns: ITyroUiDataTableColumn[] = [
    { key: 'username',    label: 'Utilisateur', labelEn: 'User',       sortable: true },
    { key: 'email',       label: 'Email',                              sortable: true },
    { key: 'accessLevel', label: 'Accès',       labelEn: 'Access',     sortable: true, filterable: true, width: '190px' },
    { key: 'createdAt',   label: 'Inscrit le',  labelEn: 'Signed up',  sortable: true, width: '160px' },
    { key: 'actions',     label: '',                                   width: '110px', align: 'right' },
  ];

  readonly rows = computed(() => this.users().map(u => ({
    id:          u.id,
    // Nom affiché + pseudo : la recherche et le tri trouvent les deux.
    username:    `${hubUserName(u)} @${u.username}`,
    email:       this.admin.defaultEmail(u),
    // "suspendu" ajouté pour que la recherche/le filtre trouvent les comptes bannis.
    accessLevel: u.accessLevel + (u.bannedAt ? ' suspendu banned' : ''),
    level:       u.accessLevel,
    banned:      !!u.bannedAt,
    createdAt:   u.createdAt,
    user:        u,
  })));

  ngOnInit() {
    this.load();
  }

  async load() {
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const res = await this.admin.getAllUsers();
      if (!res.success) throw new Error();
      this.users.set(res.data ?? []);
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  open(id: number) {
    this.router.navigate(['/utilisateurs', id]);
  }

  date(iso: string) { return formatDate(iso, this.lang()); }
}
