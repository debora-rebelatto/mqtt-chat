import { Component, Input, Output, EventEmitter } from '@angular/core'
import { User } from '../../../../models/user.model'

@Component({
  selector: 'user-list-item',
  templateUrl: './user-list-item.component.html'
})
export class UserListItemComponent {
  @Input() user!: User
  @Input() selected: boolean = false

  @Output() click = new EventEmitter<void>()

  onClick(): void {
    this.click.emit()
  }
}
