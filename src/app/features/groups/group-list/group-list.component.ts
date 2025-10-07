import { Component, Input, Output, EventEmitter, OnDestroy, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { LucideAngularModule, Users } from 'lucide-angular'
import { ListContainerComponent } from '../../../components/list-container/list-container.component'
import { ChatType, Group, SelectedChat } from '../../../models'
import { TranslatePipe } from '../../../pipes/translate.pipe'
import { GroupListItemComponent } from '../group-list-item/group-list-item.component'
import { GroupModalComponent } from '../group-modal/group-modal.component'
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
    GroupListItemComponent,
    GroupModalComponent
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
  availableGroups: Group[] = []
  groupChats: Group[] = []
  newGroupName = ''
  groups: Group[] = []
  showModal = false

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
    if (!this.appState.user) return
    
    const userGroups = this.groups.filter((g) =>
      g.members.some((member) => member && member.id === this.appState.user!.id)
    )

    this.groupChats = userGroups.map((g) => ({
      id: g.id,
      name: g.name,
      leader: g.leader,
      members: g.members,
      unread: 0,
      createdAt: new Date()
    }))

    userGroups.forEach((group) => {
      this.chatService.subscribeToGroup(group.id, this.appState.user!.name)
    })

    this.availableGroups = this.groups
      .filter((g) => !g.members.some((member) => member && member.id === this.appState.user!.id))
      .map((g) => new Group(g.id, g.name, g.leader, g.members))
  }

  onCreateGroup(): void {
    this.showModal = true
  }
  onModalClose(): void {
    this.showModal = false
    this.newGroupName = ''
  }

  onModalGroupCreate(): void {
    if (this.newGroupName.trim()) {
      this.groupService.createGroup(this.newGroupName.trim(), this.appState.user!)

      this.showModal = false
      this.newGroupName = ''

      this.createGroup.emit()
    }
  }

  onModalGroupNameChange(value: string) {
    this.newGroupName = value
  }
}
