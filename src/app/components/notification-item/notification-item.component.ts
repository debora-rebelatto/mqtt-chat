import { Component, EventEmitter, Input, Output } from '@angular/core'
import { TranslateModule } from '@ngx-translate/core'

@Component({
  selector: 'notification-item',
  templateUrl: './notification-item.component.html',
  standalone: true,
  imports: [TranslateModule]
})
export class ListContainerComponent {
  @Output() accept = new EventEmitter<void>()
  @Output() reject = new EventEmitter<void>()
  @Input() isProcessing = false

  onAccept(): void {
      this.accept.emit()

  }

  onReject(): void {
      this.reject.emit()

  }
}
