import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { LucideAngularModule, MessageCircle, Users, Search } from 'lucide-angular'
import { GroupModalComponent } from '../group-modal/group-modal.component'
import { AvailableGroup } from '../../models/available-group.model'
import { GroupChat } from '../../models/group-chat.model'
import { UserChats } from '../../models/user-chat.model'
import { TranslatePipe } from '../../pipes/translate.pipe'
import { TimeFormatPipe } from '../../pipes/time-format.pipe'
import { MemberCountPipe } from '../../pipes/member-count.pipe'

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, GroupModalComponent, LucideAngularModule, TranslatePipe, TimeFormatPipe, MemberCountPipe]
})
export class SidebarComponent {
  readonly MessageCircle = MessageCircle
  readonly Users = Users
  readonly Search = Search
  
  @Input() activeView = 'chat'
  @Input() userChats: UserChats[] = []
  @Input() groupChats: GroupChat[] = []
  @Input() availableGroups: AvailableGroup[] = []
  @Input() username = ''
  @Input() selectedChat: { type: string; id: string; name: string } | null = null

  showCreateGroupModal = false
  newGroupName = ''

  @Output() viewChange = new EventEmitter<string>()
  @Output() chatSelect = new EventEmitter<{ type: string; id: string; name: string }>()
  @Output() groupCreate = new EventEmitter<string>()
  @Output() joinGroup = new EventEmitter<string>()

  onViewChange(view: string) {
    this.viewChange.emit(view)
  }

  onChatSelect(type: string, id: string, name: string) {
    this.chatSelect.emit({ type, id, name })
  }

  onCreateGroup() {
    this.showCreateGroupModal = true
  }

  onJoinGroup(groupId: string) {
    this.joinGroup.emit(groupId)
  }

  onModalClose() {
    this.showCreateGroupModal = false
    this.newGroupName = ''
  }

  onModalGroupCreate() {
    if (this.newGroupName.trim()) {
      this.groupCreate.emit(this.newGroupName)
      this.showCreateGroupModal = false
      this.newGroupName = ''
    }
  }

  onModalGroupNameChange(value: string) {
    this.newGroupName = value
  }

  onModalKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.onModalGroupCreate()
    }
  }

  isSelected(type: string, id: string): boolean {
    return this.selectedChat?.type === type && this.selectedChat?.id === id
  }
}
