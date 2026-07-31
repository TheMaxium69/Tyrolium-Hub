import { Routes } from '@angular/router';
import { TyroUiNotFound } from 'tyrolium-ui';

import { Home } from './pages/home/home';

export const routes: Routes = [
  { path: '',   component: Home },
  { path: '**', component: TyroUiNotFound },
];
