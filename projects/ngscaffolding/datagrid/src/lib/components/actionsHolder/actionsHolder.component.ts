import { Component, OnInit, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { Action } from '@ngscaffolding/models';

@Component({
    selector: 'app-actions-holder',
    templateUrl: './actionsHolder.component.html',
    styleUrls: ['./actionsHolder.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActionsHolderComponent implements OnChanges {
    @Input() actions: Action[];
    @Input() actionsKey: string;
    @Input() selectedRows: any[];
    selectedRowsCount = 0;

    @Output() actionClicked = new EventEmitter<Action>();

    constructor() {}
    ngOnChanges(changes: SimpleChanges): void {
        if (changes.selectedRows && changes.selectedRows.isFirstChange !== changes.selectedRows.previousValue) {
            this.selectedRowsCount = changes.selectedRows.currentValue.length;
        }
    }

    isDisabled(action: Action): boolean {
        return (action.multipleTarget && this.selectedRowsCount < 1) || (action.selectionRequired && this.selectedRowsCount === 0);
    }

    clickHandler(action: Action) {
        if (!this.isDisabled(action)) {
            this.actionClicked.emit(action);
        }
    }
}
