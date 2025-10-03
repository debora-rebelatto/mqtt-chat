import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'
import { User } from '../../models/user.model'
import { TranslatePipe } from '../../pipes/translate.pipe'
import { SelectedChat } from '../../models/selected-chat.models'

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  standalone: true,
  imports: [CommonModule, TranslatePipe]
})
export class UserListComponent {
  @Input() users: User[] = []
  @Input() username: string = ''
  @Input() selectedChat: SelectedChat | null = null
  @Output() chatSelected = new EventEmitter<{ type: string; id: string; name: string }>()
}
