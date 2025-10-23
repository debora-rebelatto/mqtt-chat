import { Component, Input, Output, EventEmitter, OnChanges, OnDestroy, ChangeDetectorRef } from '@angular/core'
import { TranslateModule } from '@ngx-translate/core'
import { CommonModule } from '@angular/common'
import { Subscription } from 'rxjs'
import { DateFormatPipe } from '../../../pipes/date-format.pipe'
import { AppStateService, GroupService } from '../../../services'
import { UserService } from '../../../services/user.service'
import { SelectedChat, User } from '../../../models'
import { LucideAngularModule, X } from 'lucide-angular'

@Component({
  selector: 'group-members-modal',
  templateUrl: 'group-members-modal.component.html',
  standalone: true,
  imports: [CommonModule, DateFormatPipe, TranslateModule, LucideAngularModule]
})
export class GroupMembersModalComponent implements OnChanges, OnDestroy {
  readonly X = X
  @Input() isOpen = false
  @Input() selectedChat: SelectedChat | null = null
  @Output() closed = new EventEmitter<void>()

  members: User[] = []
  isLoading = false
  private usersSub?: Subscription

  constructor(
    private appState: AppStateService,
    private groupService: GroupService,
    private userService: UserService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnChanges() {
    if (this.isOpen && this.selectedChat?.isGroup()) {
      this.subscribeToGroupUsers()
    } else {
      this.unsubscribeFromUsers()
    }
  }

  private subscribeToGroupUsers() {
    const groupId = this.selectedChat?.group?.id || this.selectedChat?.id
    if (!groupId) {
      this.members = []
      return
    }

    const group = this.groupService.getGroupById(groupId)
    const memberIds = new Set((group?.members || []).map(m => m.id))

    this.usersSub?.unsubscribe()
    this.usersSub = this.userService.users$.subscribe((allUsers: User[]) => {
      this.members = (allUsers || [])
        .filter(u => memberIds.has(u.id))
        .map(u => ({ ...u } as User))
      this.cd.detectChanges()
    })
  }

  private unsubscribeFromUsers() {
    this.usersSub?.unsubscribe()
    this.usersSub = undefined
  }

  closeModal() {
    this.closed.emit()
  }

  onModalClick(event: Event) {
    event.stopPropagation()
  }

  get membersCount(): number {
    return this.members.length
  }

  get groupName(): string {
    return this.selectedChat?.name ?? ''
  }

  isCurrentUser(member: User): boolean {
    return member.id === this.appState.user?.id
  }

  isGroupLeader(member: User): boolean {
    return member.id === this.groupService.getGroupById(this.selectedChat!.id)?.leader?.id
  }

  ngOnDestroy() {
    this.usersSub?.unsubscribe()
  }
}
