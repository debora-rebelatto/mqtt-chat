import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'
import { LucideAngularModule, Search } from 'lucide-angular'
import { TranslatePipe } from '../../pipes/translate.pipe'
import { MemberCountPipe } from '../../pipes/member-count.pipe'
import { GroupChat } from '../../models/group-chat.model'
import { Group } from '../../models/group.model'
import { SelectedChat } from '../../models/selected-chat.models'

@Component({
  selector: 'app-group-list',
  templateUrl: './group-list.component.html',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslatePipe, MemberCountPipe]
})
export class GroupListComponent {
  readonly Search = Search
  @Input() username: string = ''

  @Input() groups: Group[] = []
  @Input() groupChat: GroupChat[] = []
  @Input() selectedChat: SelectedChat | null = null

  @Output() groupJoined = new EventEmitter<string>()
  @Output() createGroup = new EventEmitter<void>()
  @Output() chatSelected = new EventEmitter<GroupChat>()
}
