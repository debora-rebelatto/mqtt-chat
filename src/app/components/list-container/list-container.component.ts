import { Component, Input } from '@angular/core'
import { TranslateModule } from '@ngx-translate/core'

@Component({
  selector: 'list-container',
  templateUrl: './list-container.component.html',
  standalone: true,
  imports: [TranslateModule]
})
export class ListContainerComponent {
  @Input() isEmpty: boolean = false
  @Input() showEmptyState: boolean = true
  @Input() emptyMessage: string = ''
}
