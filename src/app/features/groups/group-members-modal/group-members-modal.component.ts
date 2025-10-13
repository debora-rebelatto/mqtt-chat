import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core'
import { CommonModule } from '@angular/common'
import { Subscription } from 'rxjs'

import { SelectedChat } from '../../../models/selected-chat.models'
import { AppStateService, GroupService } from '../../../services'
import { User } from '../../../models/user.model'
import { DateFormatPipe } from '../../../pipes/date-format.pipe'

@Component({
  selector: 'group-members-modal',
  templateUrl: 'group-members-modal.component.html',
  standalone: true,
  imports: [CommonModule, DateFormatPipe]
})
export class GroupMembersModalComponent implements OnChanges {
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
    this.subscription?.unsubscribe()
    this.isLoading = true

    this.subscription = this.groupService.groups$.subscribe(groups => {
      const groupId = this.selectedChat?.group?.id || this.selectedChat?.id
      
      if (groupId) {
        const groupData = this.groupService.getGroupDataForModal(groupId)
        this.members = groupData.members || []
      }
      
      this.isLoading = false
    })

    this.groupService.refreshGroups()
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
    return this.selectedChat?.name || 'Grupo'
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