import { NgModule, ModuleWithProviders, Injector } from '@angular/core';
import { createCustomElement } from '@angular/elements';
import { AgGridModule } from 'ag-grid-angular';

// Column/Cell Components
import { DataGridComponent } from './components/dataGrid/dataGrid.component';
import { DataGridHolderComponent } from './components/dataGridHolder/dataGridHolder.component';
import { ColumnPickerComponent } from './components/columnPicker/columnPicker.component';
import { ButtonCellComponent } from './cellTemplates/buttonCell/buttonCell.component';
import { HyperlinkCellComponent } from './cellTemplates/hyperlink-cell/hyperlinkCell.component';
import { GlyphCountComponent } from './cellTemplates/glyphCount-cell/glyphCount.component';
import {
  AuthoriseRoleGuard,
  NgsDatePipe,
  NgsDateTimePipe,
  ComponentLoaderService,
  VersionsService,
  CoreModule,
} from '@ngscaffolding/core';
import { InputBuilderModule } from '@ngscaffolding/inputbuilder';
import { ToolBarComponent } from './components/toolBar/toolBar.component';
import { FiltersHolderComponent } from './components/filtersHolder/filtersHolder.component';
import { ActionsHolderComponent } from './components/actionsHolder/actionsHolder.component';
import { ActionsPipe } from './pipes/actionsPipe/actions.pipe';
import { RouterModule, Routes } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SplitButtonModule } from 'primeng/splitbutton';
import { SidebarModule } from 'primeng/sidebar';
import { CardModule } from 'primeng/card';
import { SharedModule } from 'primeng/api';

const appRoutes: Routes = [
  {
    path: ':id',
    component: DataGridHolderComponent,
    canActivate: [AuthoriseRoleGuard],
    children: [],
  },
];

@NgModule({
  declarations: [
    ActionsHolderComponent,
    DataGridComponent,
    DataGridHolderComponent,
    ColumnPickerComponent,
    FiltersHolderComponent,
    ToolBarComponent,
    ButtonCellComponent,
    GlyphCountComponent,
    HyperlinkCellComponent,
    ActionsPipe,
  ],
  imports: [
    CommonModule,
    ButtonModule,
    TooltipModule,
    CoreModule,
    InputBuilderModule,
    SharedModule,
    ConfirmDialogModule,
    DialogModule,
    ProgressSpinnerModule,
    SplitButtonModule,
    SidebarModule,
    CardModule,
    TranslateModule.forChild(),
    AgGridModule.withComponents([
      ButtonCellComponent,
      HyperlinkCellComponent,
      GlyphCountComponent,
    ]),
    RouterModule.forChild(appRoutes),
  ],
  providers: [NgsDatePipe, NgsDateTimePipe],
  exports: [DataGridComponent, DataGridHolderComponent],
})
export class DatagridModule {
  static forRoot(): ModuleWithProviders<DatagridModule> {
    return {
      ngModule: DatagridModule,
    };
  }

  constructor(
    injector: Injector,
    componentLoaderService: ComponentLoaderService,
    versions: VersionsService
  ) {

    // registering our Angular Component
    const el = createCustomElement(DataGridComponent, { injector });
    customElements.define('ngs-data-grid-widget', el);
    componentLoaderService.registerComponent('ngs-data-grid-widget');

    // registering our Angular Component
    const el2 = createCustomElement(DataGridHolderComponent, { injector });
    customElements.define('ngs-data-grid-holder-widget', el2);
    componentLoaderService.registerComponent('ngs-data-grid-holder-widget');
  }
}
