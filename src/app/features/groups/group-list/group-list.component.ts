import { AppStateService } from './../../../services/app-state.service'
import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'
import { LucideAngularModule, Search } from 'lucide-angular'
import { BadgeComponent } from '../../../components/badge/badge.component'
import { ListContainerComponent } from '../../../components/list-container/list-container.component'
import { Group, SelectedChat } from '../../../models'
import { GroupCardComponent } from '../group-card/group-card.component'

@Component({
  selector: 'group-list',
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

  @Input() groups: Group[] = []
  @Input() groupChat: Group[] = []
  @Input() selectedChat: SelectedChat | null = null

  @Output() groupJoined = new EventEmitter<string>()
  @Output() createGroup = new EventEmitter<void>()
  @Output() chatSelected = new EventEmitter<Group>()

  constructor(private appService: AppStateService) {}

  isLeader(leader: string): boolean {
    return this.appService.username === leader ? true : false
  }
}
