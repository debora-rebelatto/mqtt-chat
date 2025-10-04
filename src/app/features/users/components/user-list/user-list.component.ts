import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'
import { User } from '../../models/user.model'
import { SelectedChat } from '../../models/selected-chat.models'
import { ListContainerComponent } from '../list-container/list-container.component'
import { UserListItemComponent } from '../user-list-item/user-list-item.component'

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  standalone: true,
  imports: [CommonModule, ListContainerComponent, UserListItemComponent]
})
export class UserListComponent {
  @Input() users: User[] = []
  @Input() username: string = ''
  @Input() selectedChat: SelectedChat | null = null
  @Output() chatSelected = new EventEmitter<SelectedChat>()
}
