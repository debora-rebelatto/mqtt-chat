import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core'
import { TranslateModule } from '@ngx-translate/core'
import { CommonModule } from '@angular/common'
import { Subscription } from 'rxjs'
import { DateFormatPipe } from '../../../pipes/date-format.pipe'
import { AppStateService, GroupService } from '../../../services'
import { SelectedChat, User } from '../../../models'
import { LucideAngularModule, X } from 'lucide-angular'

@Component({
  selector: 'group-members-modal',
  templateUrl: 'group-members-modal.component.html',
  standalone: true,
  imports: [CommonModule, DateFormatPipe, TranslateModule, LucideAngularModule]
})
export class GroupMembersModalComponent implements OnChanges {
  readonly X = X
  @Input() isOpen = false
  @Input() selectedChat: SelectedChat | null = null
  @Output() closed = new EventEmitter<void>()

  members: User[] = []
  isLoading = false
  private subscription?: Subscription

  constructor(
    private appState: AppStateService,
    private groupService: GroupService
  ) {}

  ngOnChanges() {
    if (this.isOpen && this.selectedChat?.isGroup()) {
      this.loadMembers()
    }
  }

  private loadMembers() {
    const groupId = this.selectedChat?.group?.id || this.selectedChat?.id
    if (!groupId) {
      this.members = []
      return
    }

    const group = this.groupService.getGroupById(groupId)
    this.members = group?.members || []
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
    return member.id === this.selectedChat?.group?.leader?.id
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe()
  }
}
