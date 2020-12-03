import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, OnChanges, SimpleChanges, ElementRef } from '@angular/core';

import { GridOptions, ColDef, GridApi, ColumnApi } from 'ag-grid-community';

import {
  Action,
  GridViewDetail,
  InputBuilderDefinition,
  DialogOptions,
  IDashboardItem,
  ActionTypes,
  AppSettings,
} from '@ngscaffolding/models';

import { MessageService } from 'primeng/api';

import { ButtonCellComponent } from '../../cellTemplates/buttonCell/buttonCell.component';
import { HyperlinkCellComponent } from '../../cellTemplates/hyperlink-cell/hyperlinkCell.component';
import { GlyphCountComponent } from '../../cellTemplates/glyphCount-cell/glyphCount.component';
import { Subscription, isObservable } from 'rxjs';
import { GridExtensionsService } from '../../services/gridExtensions/gridExtensions.service';
import { ConfirmationService } from 'primeng/api';

// import * as Papa from 'papaparse';
import { first } from 'rxjs/operators';
import { DatagridPersistenceModel } from '../../models/datagrid-persistance.model';
import { InputBuilderPopupComponent } from '@ngscaffolding/inputbuilder';
import {
  LoggingService,
  NgsDatePipe,
  NgsDateTimePipe,
  AppSettingsQuery,
  ReferenceValuesService,
  DataSourceService,
  ComponentLoaderService,
  BroadcastService,
  UserPreferencesService,
  UserPreferencesQuery,
  UserAuthenticationBase,
} from '@ngscaffolding/core';

@Component({
    selector: 'ngs-data-grid',
    templateUrl: './dataGrid.component.html',
    styleUrls: ['./dataGrid.component.scss']
})
export class DataGridComponent implements IDashboardItem, OnInit, OnDestroy, OnChanges {
    @ViewChild(InputBuilderPopupComponent, { static: false }) actionInputPopup: InputBuilderPopupComponent;
    @ViewChild('dialog', { static: false }) dialog: ElementRef;

    @Input() isWidget: boolean;
    @Input() itemId: string;
    @Input() itemDetails: GridViewDetail;
    @Input() fixedHeight: number;
    @Input() overrideGridOptions: object;
    @Input() agGridTheme: string;

    // Base context, passed to Actions
    @Input() baseContext: object;

    @Output() selectionChanged = new EventEmitter<object[]>();
    @Output() rowClicked = new EventEmitter<object>();

    filterValues: object = {};
    filters: InputBuilderDefinition;

    actions: Action[];

    showActionBar = false;
    showFilters = true;
    showToolPanel = false;
    heightToReserve = 0;

    actionInputDefinition: InputBuilderDefinition;
    actionValues: any;
    actionFile: string;

    gridOptions: GridOptions;
    selectedRows: any[];
    columnDefs: any[];
    rowData: any[];
    rowCount: number;
    hideLabels = true;
    hideFiltersButton: boolean;
    gridThemeName = 'ag-theme-material';

    // setting Parent Height uses relative to parent sizing
    parentHeight = 0;

    // Show spinner when loading
    dataLoading: boolean;

    // Dialog Settings
    popupShown = false;
    dialogOptions: DialogOptions = {};
    dialogStyle: object;

    private gridviewPrefPrefix = 'GridViewPrefs_';

    private clickedAction: Action;

    private broadcastSubscription: Subscription;

    private gridApi: GridApi;
    private gridColumnApi: ColumnApi;

    constructor(
        private log: LoggingService,
        private ngsDatePipe: NgsDatePipe,
        private ngsDateTimePipe: NgsDateTimePipe,
        private appSettings: AppSettingsQuery,
        private referenceService: ReferenceValuesService,
        private dataSourceService: DataSourceService,
        private componentLoader: ComponentLoaderService,
        private broadcast: BroadcastService,
        private confirmationService: ConfirmationService,
        private messageService: MessageService,
        private prefService: UserPreferencesService,
        private prefsQuery: UserPreferencesQuery,
        private gridExtensionsService: GridExtensionsService,
        private authService: UserAuthenticationBase
    ) {
        this.gridOptions = <GridOptions>{
            defaultColDef: {
                filter: true,
                sortable: true,
                resizable: true
            },
            accentedSort: true,
            statusBar: {
                statusPanels: [
                    { statusPanel: 'agTotalAndFilteredRowCountComponent', align: 'left' },
                    { statusPanel: 'agTotalRowCountComponent', align: 'center' },
                    { statusPanel: 'agFilteredRowCountComponent' },
                    { statusPanel: 'agSelectedRowCountComponent' },
                    { statusPanel: 'agAggregationComponent' }
                ]
            },
            sideBar: {
                toolPanels: [
                    {
                        id: 'columns',
                        labelDefault: 'Columns',
                        labelKey: 'columns',
                        iconKey: 'columns',
                        toolPanel: 'agColumnsToolPanel'
                    },
                    {
                        id: 'filters',
                        labelDefault: 'Filters',
                        labelKey: 'filters',
                        iconKey: 'filter',
                        toolPanel: 'agFiltersToolPanel'
                    }
                ]
            },

            groupMultiAutoColumn: true,
            rowGroupPanelShow: 'always',

            rowSelection: 'multiple',
            suppressCellSelection: true,

            columnTypes: {
                dateColumn: {
                    filter: 'agDateColumnFilter',
                    valueFormatter: data => {
                        return this.ngsDatePipe.transform(data.value);
                    },
                    suppressMenu: true
                },
                dateTimeColumn: {
                    filter: 'agDateColumnFilter',
                    valueFormatter: data => {
                        return this.ngsDateTimePipe.transform(data.value);
                    },
                    suppressMenu: true
                }
            },

            // context used to call back from button ColumnP
            context: {
                componentParent: this
            },
            onFirstDataRendered: () => {
                this.calculateHeights();
                // Allow components to redraw
                window.dispatchEvent(new Event('resize'));
            },
            onRowClicked: row => {
                const htmlName = row.event['toElement']['offsetParent']['localName'];
                if (htmlName !== 'button') {
                    this.rowClicked.emit(row.data);
                }
            },
            onGridReady: () => {
                this.calculateHeights();
            }
        };

        // Add in custom Renderers
        const renderers = {};
        for (const renderer of this.gridExtensionsService.cellRenderers) {
            renderers[renderer.name] = renderer.renderer;
        }

        this.gridOptions.frameworkComponents = renderers;

        // Add in rowClass Functions
        this.gridOptions.rowClassRules = this.gridExtensionsService.rowClassFunctions;

        this.broadcastSubscription = this.broadcast.on('CLOSE_POPUP').subscribe(saved => {
            this.popupShown = false;
            if (saved) {
                this.refreshData();
            }
        });
    }

    private resetPropertyValues() {
        this.filterValues = {};
        this.actionValues = null;
        this.actionFile = null;
        this.selectedRows = [];
        this.dataLoading = false;
        this.popupShown = false;
    }

    // Toolbar Operations
    showHideFilters() {
        this.showFilters = !this.showFilters;
        this.calculateHeights();
    }

    showHideColumns() {
        this.showToolPanel = !this.showToolPanel;

        this.gridApi.setSideBarVisible(this.showToolPanel);
    }

    exportData() {
        this.gridApi.exportDataAsCsv();
    }

    // Expose Method in Angular Element
    // https://github.com/angular/angular/issues/22114
    // Dashboard Item Interface
    @Input()
    public refreshData = () => {
        this.log.info('DataGrid: Refreshing Data');
        this.loadData();
    };

    @Input()
    public updateData = (newData: any) => {
        this.filterValues = newData;
    };

    saveView() {
        const savedState = this.readGridState();
        this.prefService.setValue(this.gridviewPrefPrefix + this.itemId, JSON.stringify(savedState)).subscribe(
            () => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Success',
                    detail: 'View Saved'
                });
            },
            () => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'View not Saved'
                });
            }
        );
    }

    private readGridState(): DatagridPersistenceModel {
        return {
            columnState: this.gridColumnApi.getColumnState(),
            sortState: this.gridApi.getSortModel(),
            filterState: this.gridApi.getFilterModel()
        };
    }

    private applyGridState(gridState: DatagridPersistenceModel) {
        if (gridState && gridState.columnState && this.columnDefs) {
            this.log.info(`Loaded grid state`);
            this.gridColumnApi.setColumnState(gridState.columnState);
            this.gridApi.setSortModel(gridState.sortState);
            this.gridApi.setFilterModel(gridState.filterState);
        }
    }

    resetView() {
        // Remove our saved settings
        this.prefService.deleteValue(this.gridviewPrefPrefix + this.itemId).subscribe(
            () => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Success',
                    detail: 'View Reset'
                });
                this.loadMenuItem();
            },
            () => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'View not Reset'
                });
            }
        );

        this.gridColumnApi.resetColumnState();
        this.gridColumnApi.autoSizeAllColumns();
        this.gridApi.setFilterModel(null);
        this.gridApi.onFilterChanged();
        this.gridApi.setSortModel(null);
        this.gridApi.onSortChanged();
    }
    shareView() {}
    // Toolbar Operations

    onGridReady(params) {
        this.gridColumnApi = params.columnApi;
        this.gridApi = params.api;
    }

    onRowDataChanged(event: any) {
        this.autoSizeAll(false);
    }
    onFirstDataRendered(event: any) {
        this.autoSizeAll(false);
    }

    autoSizeAll(skipHeader = false) {
        if (this.gridColumnApi && !this.itemDetails?.bypassAutoSizeColumns) {
            const allColumnIds = [];
            this.gridColumnApi.getAllColumns().forEach(function(column) {
                allColumnIds.push(column['colId']);
            });
            setTimeout(() => {
                this.gridColumnApi.autoSizeColumns(allColumnIds, skipHeader);
            }, 60);
        }
    }

    onFiltersUpdated(filters) {
        this.filterValues = filters;

        this.loadData();
    }

    onSelectionChanged() {
        this.selectedRows = this.gridApi.getSelectedRows();
        this.selectionChanged.emit(this.selectedRows);
    }

    private calculateHeights() {
        let height = 0;
        if (!this.isWidget) {
            if (this.showFilters) {
                height += 62;
            }
            if (this.showActionBar) {
                height += 52;
            }
        }
        this.heightToReserve = height;
    }

    // Load First Data and if any criteria Changes
    public loadData() {
        this.rowData = [];

        this.dataLoading = true;

        if (this.itemDetails.dataValues) {
            if (isObservable(this.itemDetails.dataValues)) {
                this.itemDetails.dataValues.subscribe(results => {
                    this.rowData = results as any[];
                    this.autoSizeAll(false);
                    this.dataLoading = false;
                });
            } else {
                this.rowData = this.itemDetails.dataValues;
                this.rowCount = this.itemDetails.dataValues.length;
                this.autoSizeAll(false);
                this.dataLoading = false;
            }
        } else if (this.itemDetails.selectDataSourceName) {
            this.dataSourceService
                .getDataSource({
                    forceRefresh: true,
                    name: this.itemDetails.selectDataSourceName,
                    filterValues: { ...this.baseContext, ...this.filterValues },
                    seed: this.itemDetails.seedValue
                })
                .subscribe(
                    results => {
                        if (results.jsonData) {
                            if (typeof results.jsonData === 'string') {
                                this.rowData = JSON.parse(results.jsonData);
                            } else {
                                this.rowData = results.jsonData;
                            }

                            if (results.rowCount) {
                                this.rowCount = results.rowCount;
                            }
                        }
                        this.autoSizeAll(false);
                        this.dataLoading = false;
                    },
                    () => {
                        this.dataLoading = false;
                    }
                );
        }
    }

    private loadMenuItem() {
        if (this.itemDetails) {
            this.columnDefs = [];

            this.actions = this.authService.filterItemsByRole(this.itemDetails.actions);

            this.filters = this.itemDetails.filters;
            if (this.filters && this.filters.inputDetails && this.filters.inputDetails.length > 0) {
                this.hideFiltersButton = false;
            } else {
                this.hideFiltersButton = true;
            }

            // Switch off RowSelection
            this.gridOptions.suppressRowClickSelection = false;

            let weWantCheckboxes = false;
            if (this.itemDetails.disableCheckboxSelection !== undefined) {
                weWantCheckboxes = !this.itemDetails.disableCheckboxSelection;
            }

            // Do We need a Checkbox
            if (weWantCheckboxes || (this.actions && this.actions.some(action => action.selectionRequired))) {
                // Add the selection column
                this.columnDefs.push(<ColDef>{
                    colId: 'selectionCol',
                    maxWidth: 40,
                    suppressMenu: true,
                    filter: false,
                    sortable: false,
                    checkboxSelection: true,
                    pinned: 'left',
                    headerCheckboxSelection: true,
                    headerCheckboxSelectionFilteredOnly: false
                });
            }

            if (this.itemDetails.isDataIsland) {
                this.gridOptions.rowGroupPanelShow = 'onlyWhenGrouping';
                this.gridOptions.statusBar = null;
            }

            if (this.itemDetails.rowClassRules) {
                this.gridOptions.rowClassRules = this.itemDetails.rowClassRules;
            }

            // Do We need an Actions button
            if (this.actions && this.actions.filter(action => action.columnButton).length > 0) {
                this.columnDefs.push({
                    // minWidth: 70 + (100 * howMany),
                    headerName: 'Actions',
                    colId: 'Id',
                    suppressMenu: true,
                    filter: false,
                    sortable: false,
                    pinned: 'left',
                    field: 'Id',
                    cellRendererFramework: ButtonCellComponent,
                    cellRendererParams: {
                        actions: this.itemDetails.actions,
                        splitButton: this.itemDetails.isActionColumnSplitButton
                    }
                });
            }

            for (const column of this.authService.filterItemsByRole(this.itemDetails.columns)) {
                this.columnDefs.push(this.createColumn(column));
            }

            // Actions Here
            this.showActionBar = this.actions && this.actions.filter(action => !action.columnButton).length > 0;
        }

        this.prefsQuery.selectEntity(this.gridviewPrefPrefix + this.itemId).subscribe(pref => {
            if (pref) {
                const gridSavedState = JSON.parse(pref.value);
                if (this.gridColumnApi && this.columnDefs) {
                    setTimeout(_ => {
                        this.applyGridState(gridSavedState);
                    }, 10);
                }
            }
        });

        this.loadData();
    }

    private createColumn(columnDef: any): ColDef {
        const newCol = { ...columnDef };
        newCol.enableRowGroup = true;

        switch (columnDef.type) {
            case 'hyperLink': {
                newCol.cellRendererFramework = HyperlinkCellComponent;
                newCol.cellRendererParams = {
                    columnModel: columnDef
                };
                break;
            }
            case 'glyphCount': {
                newCol.cellRendererFramework = GlyphCountComponent;
                newCol.cellRendererParams = {
                    columnModel: columnDef
                };
                break;
            }
        }

        if (!columnDef.colId) {
            newCol.colId = columnDef.field;
        }
        return newCol;
    }

    //
    // Action Stuff
    //
    actionClicked(action: Action, row: any) {
        // check if we need confirmation
        if (action.confirmationMessage) {
            this.confirmationService.confirm({
                key: this.itemDetails.title,
                message: action.confirmationMessage,
                header: 'Confirmation',
                accept: () => {
                    this.checkForActionInputs(action, row);
                }
            });
        } else {
            // Just do it without asking
            this.checkForActionInputs(action, row);
        }
    }

    private checkForActionInputs(action: Action, row: any) {
        if (action.inputBuilderDefinition && action.inputBuilderDefinition.inputDetails.length > 0) {
            this.clickedAction = action;
            this.actionInputDefinition = action.inputBuilderDefinition;
            this.getDialogSizing(action.inputBuilderDefinition.width, action.inputBuilderDefinition.height);

            if (row) {
                this.actionValues = row;
            } else {
                this.actionValues = {};
            }
            this.actionInputPopup.showPopup();
        } else {
            if (row) {
                this.actionValues = row;
            } else {
                this.actionValues = {};
            }
            this.callAction(action, row);
        }
    }

    public popupHidden() {}

    private getDialogSizing(width: any, height: any) {
        this.dialogStyle = {};
        if (width && height) {
            this.dialogStyle = { width: width + 'px', height: height + 'px' };
        }
    }

    private callAction(action: Action, row: any) {
        switch (action.type) {
            case ActionTypes.angularComponent: {
                this.componentLoader.loadComponent(action.angularComponent).then(newComponent => {
                    newComponent['data'] = row;

                    if (action.idValue) {
                        newComponent['idValue'] = action.idValue;
                    }
                    if (action.additionalProperties) {
                        newComponent['additionalProperties'] = action.additionalProperties;
                    }

                    newComponent.addEventListener('closed', () => {
                        this.popupShown = false;
                        if (action.flushReferenceValues) {
                            // Remove cached version
                            this.referenceService.clearReferenceValue(action.flushReferenceValues);
                        }
                        if (action.refresh) {
                            this.loadData();
                        }
                    });

                    this.popupShown = true;
                    // Give the dialog time to open
                    window.setTimeout(() => {
                        this.dialog.nativeElement.appendChild(newComponent);
                    });
                });

                // Use the options from our action
                if (action.dialogOptions) {
                    this.getDialogSizing(action.dialogOptions.width, action.dialogOptions.height);
                    this.dialogOptions = action.dialogOptions;
                } else {
                    this.dialogOptions = {};
                }

                break;
            }
            default: {
                let rowsToProcess: object[] = this.selectedRows;

                // If user uploaded file. Use this as rows once parsed
                // if (this.actionFile) {
                //     rowsToProcess = Papa.parse(this.actionFile, {
                //         header: true
                //     }).data;
                // }
                this.dataSourceService
                    .getDataSource({
                        name: action.dataSourceName,
                        inputData: { ...this.baseContext, ...this.actionValues },
                        rowData: rowsToProcess,
                        forceRefresh: true
                    })
                    .pipe(first(result => !result.inflight))
                    .subscribe(
                        result => {
                            if (!result.error) {
                                if (action.flushReferenceValues) {
                                    // Remove cached version
                                    this.referenceService.clearReferenceValue(action.flushReferenceValues);
                                }
                                if (action.successMessage) {
                                    this.messageService.add({
                                        severity: 'success',
                                        summary: 'Success',
                                        detail: action.successMessage,
                                        life: 5000
                                    });
                                }
                                // finally
                                this.actionInputPopup.isShown = false;

                                // Refresh Data
                                this.loadData();
                            } else {
                                if (action.errorMessage) {
                                    this.confirmationService.confirm({
                                        message: action.errorMessage,
                                        icon: 'fa-close',
                                        acceptLabel: 'OK',
                                        header: 'Error',
                                        rejectVisible: false
                                    });
                                }
                            }
                        },
                        () => {
                            if (action.errorMessage) {
                                this.confirmationService.confirm({
                                    message: action.errorMessage,
                                    icon: 'fa-close',
                                    acceptLabel: 'OK',
                                    header: 'Error',
                                    rejectVisible: false
                                });
                            }
                        }
                    );
            }
        }
    }

    //
    // User Clicked OK on popup
    //
    actionOkClicked(model: object) {
        this.actionValues = model[0];
        this.actionFile = model[1];

        // Setup call to service to run Action
        // Once Complete

        this.callAction(this.clickedAction, model);
    }

    // User clicked Cancel
    actionCancelClicked() {}

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.agGridTheme && changes.agGridTheme.currentValue !== changes.agGridTheme.previousValue) {
            this.gridThemeName = `ag-theme-${changes.agGridTheme.currentValue}`;
        }
        if (changes.itemDetails && changes.itemDetails.currentValue) {
            this.resetPropertyValues();
            this.loadMenuItem();
        }

        if (changes.isWidget && changes.isWidget.currentValue) {
            this.parentHeight = 90;
        }

        // We have some incomming updates to gridOptions
        if (changes.overrideGridOptions && changes.overridegridCurrentValue) {
            this.gridOptions = { ...this.gridOptions, ...changes.overridegridCurrentValue };
        }
    }

    ngOnInit(): void {
        if (this.appSettings.hasEntity(AppSettings.agGridTheme)) {
            this.gridThemeName = `ag-theme-${this.appSettings.getEntity(AppSettings.agGridTheme).value}`;
        }
    }

    ngOnDestroy() {
        if (this.broadcastSubscription) {
            this.broadcastSubscription.unsubscribe();
        }
    }
}
