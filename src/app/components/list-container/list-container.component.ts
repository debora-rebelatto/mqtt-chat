import { Component, Input } from '@angular/core'
import { TranslatePipe } from '../../pipes/translate.pipe'

@Component({
  selector: 'list-container',
  templateUrl: './list-container.component.html',
  standalone: true,
  imports: [TranslatePipe]
})
export class ListContainerComponent {
  @Input() isEmpty: boolean = false
  @Input() showEmptyState: boolean = true
  @Input() emptyMessage: string = ''
}
