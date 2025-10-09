import { Component, Input, Output, EventEmitter, OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { Subscription } from 'rxjs'

import { SelectedChat } from '../../../models/selected-chat.models'
import { AppStateService, GroupService } from '../../../services'
import { User } from '../../../models/user.model'

@Component({
  selector: 'group-members-modal',
  templateUrl: 'group-members-modal.component.html',
  standalone: true,
  imports: [CommonModule]
})
export class GroupMembersModalComponent implements OnDestroy {
  @Input() isOpen = false
  @Input() selectedChat: SelectedChat | null = null
  @Output() closed = new EventEmitter<void>()

  members: User[] = []
  isLoading = true
  private subscription!: Subscription

  constructor(
    private appState: AppStateService,
    private groupService: GroupService
  ) {}

  ngOnChanges() {
    if (this.isOpen && this.selectedChat?.isGroup()) {
      this.loadMembers()
    } else {
      this.isLoading = false
    }
  }

  private loadMembers() {
    if (this.subscription) {
      this.subscription.unsubscribe()
    }

    this.isLoading = true

    this.subscription = this.groupService.groups$.subscribe((groups) => {
      const groupId = this.getGroupId()

      if (!groupId) {
        this.useFallbackMembers()
        return
      }

      const groupData = this.groupService.getGroupDataForModal(groupId)

      if (groupData.group && groupData.members.length > 0) {
        this.members = groupData.members
        this.isLoading = false
      } else {
        this.useFallbackMembers()
      }
    })

    this.groupService.refreshGroups()

    setTimeout(() => {
      if (this.isLoading) {
        this.loadMembersDirect()
      }
    }, 3000)
  }

  private getGroupId(): string | null {
    if (!this.selectedChat) return null

    if (this.selectedChat.group?.id) {
      return this.selectedChat.group.id
    } else if (this.selectedChat.id && this.selectedChat.isGroup()) {
      return this.selectedChat.id
    }

    return null
  }

  private loadMembersDirect(): void {
    const groupId = this.getGroupId()

    if (groupId) {
      const groupData = this.groupService.getGroupDataForModal(groupId)
      if (groupData.members.length > 0) {
        this.members = groupData.members
      } else {
        this.useFallbackMembers()
      }
    } else {
      this.useFallbackMembers()
    }

    this.isLoading = false
  }

  private useFallbackMembers(): void {
    if (this.selectedChat?.group?.members && this.selectedChat.group.members.length > 0) {
      this.members = this.selectedChat.group.members
    } else if (this.selectedChat?.getMembers && this.selectedChat.getMembers().length > 0) {
      this.members = this.selectedChat.getMembers()
    } else {
      this.members = []
    }

    this.isLoading = false
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe()
    }
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

  getMemberStatus(member: User): string {
    if (!member) return 'Desconhecido'

    if (member.online) {
      return 'Online'
    } else if (member.lastSeen) {
      const lastSeen = new Date(member.lastSeen)
      const now = new Date()
      const diffMs = now.getTime() - lastSeen.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMins / 60)
      const diffDays = Math.floor(diffHours / 24)

      if (diffMins < 1) return 'Visto agora há pouco'
      if (diffMins < 60) return `Visto há ${diffMins} minuto${diffMins > 1 ? 's' : ''}`
      if (diffHours < 24) return `Visto há ${diffHours} hora${diffHours > 1 ? 's' : ''}`
      return `Visto há ${diffDays} dia${diffDays > 1 ? 's' : ''}`
    } else {
      return 'Offline'
    }
  }

  isCurrentUserMember(member: User): boolean {
    const currentUser = this.appState.user
    return currentUser ? member.id === currentUser.id : false
  }

  isGroupLeader(member: User): boolean {
    if (!this.selectedChat?.isGroup() || !this.selectedChat.group) {
      return false
    }
    return member.id === this.selectedChat.group.leader.id
  }
}
