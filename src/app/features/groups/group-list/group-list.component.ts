import { Component, Input, Output, EventEmitter, OnDestroy, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { TranslateModule } from '@ngx-translate/core'

import { LucideAngularModule, Users } from 'lucide-angular'
import { ListContainerComponent } from '../../../components/list-container/list-container.component'
import { ChatType, Group, SelectedChat } from '../../../models'
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
    GroupListItemComponent,
    GroupModalComponent,
    TranslateModule
  ]
})
export class GroupListComponent implements OnInit, OnDestroy {
  readonly Users = Users

  @Input() selectedChat: SelectedChat | null = null
  @Output() createGroup = new EventEmitter<void>()
  @Output() groupSelected = new EventEmitter<Group>()

  groupChats: Group[] = []
  newGroupName = ''
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
      this.groupChats = groups

      const currentUserId = this.appState.user?.id
      if (currentUserId) {
        this.groupChats = groups.filter(
          (group) =>
            group.leader.id === currentUserId ||
            group.members.some((member) => member.id === currentUserId)
        )
      }
    })
  }

  onGroupClick(group: Group): void {
    this.appState.selectChat(ChatType.Group, group.id, group.name)
    this.groupSelected.emit(group)
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
