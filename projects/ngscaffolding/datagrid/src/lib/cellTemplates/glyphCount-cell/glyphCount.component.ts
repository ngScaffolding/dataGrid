import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { Action } from '@ngscaffolding/models';

export interface ActionClickedData {
    action: Action;
    row: any;
}

@Component({
    selector: 'app-glyphCount-cell',
    templateUrl: 'glyphCount.component.html',
    styleUrls: ['glyphCount.component.scss']
})
export class GlyphCountComponent implements ICellRendererAngularComp {
    public params: any;

    public cell: any;

    public iconName = false;
    public countText = '';
    public toolText = '';

    agInit(params: any): void {
        this.params = params;
        if (params.colDef && params.data) {
            if (params.data[params.colDef.field]) {
                this.countText = params.data[params.colDef.field];
            }
            this.iconName = params.colDef.icon;
            if (params.colDef.toolText) {
                this.toolText = params.colDef.toolText;
            }
            this.cell = { row: params.data, col: params.colDef.headerName };
        }
    }

    refresh(): boolean {
        return false;
    }
}
