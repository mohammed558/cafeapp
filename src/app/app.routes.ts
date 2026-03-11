import { Routes } from '@angular/router';
import { OrderingMenuComponent } from './components/ordering-menu/ordering-menu.component';
import { KdsComponent } from './components/kds/kds.component';

export const routes: Routes = [
  { path: '', redirectTo: 'menu', pathMatch: 'full' },
  { path: 'menu', component: OrderingMenuComponent },
  { path: 'kds', component: KdsComponent }
];
