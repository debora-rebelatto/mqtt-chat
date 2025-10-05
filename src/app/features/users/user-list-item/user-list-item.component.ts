import { Component, Input, Output, EventEmitter } from '@angular/core'
import { User } from '../../../models/user.model'
import { DateFormatPipe } from '../../../pipes/date-format.pipe'

@Component({
  selector: 'user-list-item',
  standalone: true,
  templateUrl: './user-list-item.component.html',
  imports: [DateFormatPipe]
})
export class UserListItemComponent {
  @Input() user!: User
  @Input() selected: boolean = false

  @Output() click = new EventEmitter<void>()

  onClick(): void {
    this.click.emit()
  }

  get unreadCount(): number {
    return this.user.unread || 0
  }
}
