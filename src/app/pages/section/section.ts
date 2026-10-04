import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TyroUiAlert, TyroUiLangService, TyroUiPageHeader } from 'tyrolium-ui';
import { IHubSection } from '../../config/hub-sections';

/** Page provisoire d'un onglet, en attendant son vrai contenu. */
@Component({
  selector: 'app-section',
  imports: [TyroUiPageHeader, TyroUiAlert],
  templateUrl: './section.html',
})
export class Section {
  readonly lang    = inject(TyroUiLangService).lang;
  readonly section = inject(ActivatedRoute).snapshot.data['section'] as IHubSection;
}
