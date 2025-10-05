import { Component, Input, Output, EventEmitter, OnDestroy, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { LucideAngularModule, Users } from 'lucide-angular'
import { ListContainerComponent } from '../../../components/list-container/list-container.component'
import { AvailableGroup, ChatType, Group, SelectedChat } from '../../../models'
import { TranslatePipe } from '../../../pipes/translate.pipe'
import { GroupListItemComponent } from '../group-list-item/group-list-item.component'
import { Subject, takeUntil } from 'rxjs'
import { AppStateService, GroupService, ChatService } from '../../../services'

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
export class GroupListComponent implements OnInit, OnDestroy {
  readonly Users = Users

  @Input() selectedChat: SelectedChat | null = null
  @Output() groupJoined = new EventEmitter<string>()
  @Output() createGroup = new EventEmitter<void>()
  @Output() chatSelected = new EventEmitter<Group>()
  @Output() groupClick = new EventEmitter<Group>()
  @Output() groupSelected = new EventEmitter<Group>()

  availableGroups: AvailableGroup[] = []
  groupChats: Group[] = []
  newGroupName = ''
  groups: Group[] = []

  private destroy$ = new Subject<void>()

  constructor(
    private appState: AppStateService,
    private groupService: GroupService,
    private chatService: ChatService
  ) {}

  ngOnInit() {
    this.setupSubscriptions()
  }

  ngOnDestroy() {
    this.destroy$.next()
    this.destroy$.complete()
  }

  private setupSubscriptions() {
    this.groupService.groups$.pipe(takeUntil(this.destroy$)).subscribe((groups) => {
      this.groups = groups
      this.updateGroupChats()
    })
  }

  onGroupClick(group: Group): void {
    this.appState.selectChat(ChatType.Group, group.id, group.name)
    this.chatService.setCurrentChat(ChatType.Group, group.id)
    this.groupSelected.emit(group)
  }

  private updateGroupChats() {
    const userGroups = this.groups.filter((g) => g.members.includes(this.appState.username))

    this.groupChats = userGroups.map((g) => ({
      id: g.id,
      name: g.name,
      leader: g.leader,
      members: g.members,
      unread: 0,
      createdAt: new Date()
    }))

    userGroups.forEach((group) => {
      this.chatService.subscribeToGroup(group.id, this.appState.username)
    })

    this.availableGroups = this.groups
      .filter((g) => !g.members.includes(this.appState.username))
      .map((g) => ({
        id: g.id,
        name: g.name,
        leader: g.leader,
        members: g.members.length,
        description: `Grupo criado por ${g.leader}`
      }))
  }

  onModalGroupNameChange(value: string) {
    this.newGroupName = value
  }
}
