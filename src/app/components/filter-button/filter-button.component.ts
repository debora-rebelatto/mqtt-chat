import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'
import { TranslateModule } from '@ngx-translate/core'

@Component({
  selector: 'filter-button',
  templateUrl: './filter-button.component.html',
  standalone: true,
  imports: [CommonModule, TranslateModule]
})
export class FilterButtonComponent {
  @Input() filterType: 'all' | 'pending' = 'all'
  @Input() count: number = 0
  @Input() isSelected: boolean = false
  @Output() filterChange = new EventEmitter<'all' | 'pending'>()

  onFilterClick() {
    this.filterChange.emit(this.filterType)
  }

  getButtonClasses(): string {
    const baseClasses = 'px-2 py-1 text-xs rounded transition-colors'

    if (this.isSelected) {
      return this.filterType === 'all'
        ? `${baseClasses} bg-blue-600`
        : `${baseClasses} bg-yellow-600`
    }

    return `${baseClasses} bg-gray-700 hover:bg-gray-600`
  }
}
