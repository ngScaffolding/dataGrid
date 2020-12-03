import { ColumnState } from 'ag-grid-community/dist/lib/columnController/columnController';

export interface DatagridPersistenceModel {
    columnState: ColumnState[];
    sortState: any;
    filterState: any;
}
