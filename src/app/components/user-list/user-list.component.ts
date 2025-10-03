import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'
import { User } from '../../models/user.model'
import { GroupChat } from '../../models/group-chat.model'

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  standalone: true,
  imports: [CommonModule]
})
export class UserListComponent {
  @Input() users: User[] = []

  @Input() groups: GroupChat[] = []

  @Input() selectedChat: { type: string; id: string; name: string } | null = null
  @Input() username: string = ''

  @Output() chatSelected = new EventEmitter<{ type: string; id: string; name: string }>()
  @Output() createGroup = new EventEmitter<void>()
}
