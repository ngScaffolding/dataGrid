import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { Action } from '@ngscaffolding/models';

export interface ActionClickedData {
    action: Action;
    row: any;
}

@Component({
    selector: 'app-hyperlink-cell',
    templateUrl: 'hyperlinkCell.component.html',
    styleUrls: ['hyperlinkCell.component.scss']
})
export class HyperlinkCellComponent implements ICellRendererAngularComp {
    public params: any;

    public cell: any;

    public iconName = false;
    public linkText = false;

    public boundHref: string;

    public isShown = false;

    agInit(params: any): void {
        this.params = params;
        if (params.colDef) {
            let foundValuesCount = 0;

            this.iconName = params.colDef.buttonIcon;
            this.linkText = params.colDef.buttonTitle;
            let url = params.colDef.destinationUrl;

            for (const key in params.data) {
                if (params.data.hasOwnProperty(key)) {
                    url = url.replace(`@@${key}##`, params.data[key]);
                    if (params.colDef.requiredValues && params.colDef.requiredValues.includes(key) && params.data[key]) {
                        foundValuesCount++;
                    }
                }
            }
            this.boundHref = url;

            if (params.colDef.requiredValues && params.colDef.requiredValues.length > 0) {
                this.isShown = foundValuesCount === params.colDef.requiredValues.length;
            } else {
                this.isShown = true;
            }
        }
        this.cell = { row: params.data, col: params.colDef.headerName };
    }

    refresh(): boolean {
        return false;
    }
}
