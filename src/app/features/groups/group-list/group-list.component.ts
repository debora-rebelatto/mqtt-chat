import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'
import { LucideAngularModule, Search } from 'lucide-angular'
import { ListContainerComponent } from '../../../components/list-container/list-container.component'
import { Group, SelectedChat } from '../../../models'
import { TranslatePipe } from '../../../pipes/translate.pipe'
import { GroupListItemComponent } from '../group-list-item/group-list-item.component'

@Component({
  selector: 'group-list',
  templateUrl: './group-list.component.html',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    ListContainerComponent,
    TranslatePipe,
    GroupListItemComponent
  ]
})
export class GroupListComponent {
  readonly Search = Search

  @Input() groups: Group[] = []
  @Input() groupChat: Group[] = []
  @Input() selectedChat: SelectedChat | null = null

  @Output() groupJoined = new EventEmitter<string>()
  @Output() createGroup = new EventEmitter<void>()
  @Output() chatSelected = new EventEmitter<Group>()
}
