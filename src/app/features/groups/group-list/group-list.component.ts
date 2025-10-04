import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'
import { LucideAngularModule, Search } from 'lucide-angular'
import { GroupChat } from '../../../models/group-chat.model'
import { Group } from '../../../models/group.model'
import { SelectedChat } from '../../../models/selected-chat.models'
import { BadgeComponent } from '../../../shared/components/ui/badge/badge.component'
import { ListContainerComponent } from '../../../shared/components/ui/list-container/list-container.component'
import { GroupCardComponent } from '../group-card/group-card.component'

@Component({
  selector: 'app-group-list',
  templateUrl: './group-list.component.html',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    ListContainerComponent,
    GroupCardComponent,
    BadgeComponent
  ]
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
