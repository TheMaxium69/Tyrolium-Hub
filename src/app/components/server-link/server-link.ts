import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TyroUiLangService } from 'tyrolium-ui';
import { HubAuthService } from '../../services/hub-auth.service';
import { IServerSummary } from '../../services/solidserv-server.service';
import { ServerStatusChip } from '../server-status/server-status';

/**
 * Serveur SolidServ d'un site : lien vers sa fiche du Dashboard si on a PERMS_SOLIDSERV_SERVER_VIEW,
 * simple nom sinon, « Non rattaché » s'il n'y en a pas.
 */
@Component({
  selector: 'app-server-link',
  imports: [RouterLink, ServerStatusChip],
  template: `
    @if (server(); as s) {
      <span class="sl">
        @if (canView()) {
          <a class="sl-link" [routerLink]="['/solidserv/dashboard', s.id]" [title]="s.hostname ?? s.type.name">
            <i class="ri-server-line"></i>
            <span class="sl-name">{{ s.name }}</span>
          </a>
        } @else {
          <span class="sl-text" [title]="s.hostname ?? s.type.name"><i class="ri-server-line"></i> <span class="sl-name">{{ s.name }}</span></span>
        }
        @if (details()) {
          <span class="sl-type">{{ s.type.name }}@if (s.alias) { · {{ s.alias }} }</span>
          @if (s.status !== 'active') { <app-server-status [status]="s.status"></app-server-status> }
        }
      </span>
    } @else {
      <span class="sl-none">{{ lang() === 'en' ? 'Not linked' : 'Non rattaché' }}</span>
    }
  `,
  styles: `
    .sl { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; }
    .sl-link, .sl-text { display: inline-flex; align-items: center; gap: 0.3rem; }
    .sl-link { color: var(--dash-accent); text-decoration: none; }
    .sl-link:hover .sl-name { text-decoration: underline; }
    .sl-text { color: var(--dash-text); }
    .sl-name { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-weight: 600; }
    .sl-type { font-size: 0.75rem; color: var(--dash-text-2); }
    .sl-none { font-size: 0.8rem; color: var(--dash-text-muted); }
    :host-context([data-theme="dark"]) .sl-link { color: #60a5fa; }
  `,
})
export class ServerLink {
  readonly lang = inject(TyroUiLangService).lang;
  private readonly auth = inject(HubAuthService);

  readonly server  = input<IServerSummary | null>(null);
  /** Affiche aussi le type, l'alias et le statut (s'il n'est pas actif). */
  readonly details = input(true);

  canView() { return this.auth.hasRole('PERMS_SOLIDSERV_SERVER_VIEW'); }
}
