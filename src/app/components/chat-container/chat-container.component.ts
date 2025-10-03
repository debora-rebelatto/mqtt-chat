import { Component, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { CommonModule } from '@angular/common'
import { Subject, takeUntil } from 'rxjs'

import { MqttService } from '../../services/mqtt.service'
import { UserService } from '../../services/user.service'
import { GroupService } from '../../services/group.service'
import { ChatService } from '../../services/chat.service'
import { InvitationService } from '../../services/invitation.service'
import { ConnectionManagerService } from '../../services/connection-manager.service'

import { UserStatus } from '../../models/user-status.model'
import { ChatMessage } from '../../models/chat-message.model'
import { GroupInvitation } from '../../models/group-invitation.model'

import { PageHeaderComponent } from '../page-header/page-header.component'
import { NotificationsBannerComponent } from '../notifications-banner/notifications-banner.component'
import { SidebarComponent } from '../sidebar/sidebar.component'
import { ChatAreaComponent } from '../chat-area/chat-area.component'
import { AvailableGroup } from '../../models/available-group.model'
import { Group } from '../../models/group.model'
import { Messages } from '../../models/messages.model'
import { UserChats } from '../../models/user-chat.model'
import { GroupChat } from '../../models/group-chat.model'

@Component({
  selector: 'app-chat-container',
  templateUrl: './chat-container.component.html',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    PageHeaderComponent,
    NotificationsBannerComponent,
    SidebarComponent,
    ChatAreaComponent
  ]
})
export class ChatContainerComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef

  private destroy$ = new Subject<void>()

  connected = false
  username = ''
  inputMensagem = ''
  showNotifications = true
  activeView = 'chat'
  selectedChat: { type: string; id: string; name: string } | null = null

  notifications: GroupInvitation[] = []
  userChats: UserChats[] = []
  groupChats: GroupChat[] = []
  availableGroups: AvailableGroup[] = []
  messages: Messages[] = []

  private users: UserStatus[] = []
  private groups: Group[] = []
  private allMessages: ChatMessage[] = []

  constructor(
    private mqttService: MqttService,
    private userService: UserService,
    private groupService: GroupService,
    private chatService: ChatService,
    private invitationService: InvitationService,
    private connectionManager: ConnectionManagerService
  ) {}

  ngOnInit() {
    this.setupSubscriptions()
  }

  ngOnDestroy() {
    this.destroy$.next()
    this.destroy$.complete()
  }

  private setupSubscriptions() {
    this.userService.users$.pipe(takeUntil(this.destroy$)).subscribe((users) => {
      this.users = users
      this.updateUserChats()
    })

    this.groupService.groups$.pipe(takeUntil(this.destroy$)).subscribe((groups) => {
      this.groups = groups
      this.updateGroupChats()
    })

    this.chatService.messages$.pipe(takeUntil(this.destroy$)).subscribe((messages) => {
      this.allMessages = messages
      this.updateCurrentChatMessages()
    })

    this.invitationService.invitations$.pipe(takeUntil(this.destroy$)).subscribe((invitations) => {
      this.notifications = invitations
    })

    this.connectionManager.connected$.pipe(takeUntil(this.destroy$)).subscribe((connected) => {
      this.connected = connected
    })
  }

  onViewChange(view: string) {
    this.activeView = view
  }

  onChatSelect(chat: { type: string; id: string; name: string }) {
    this.selectChat(chat.type, chat.id, chat.name)
  }

  onUsernameChange(username: string) {
    this.username = username
  }

  onConnectionChange(connected: boolean) {
    this.connected = connected
  }

  onGroupCreate(groupName: string) {
    this.groupService.createGroup(groupName, this.username)
  }

  onJoinGroup(groupId: string) {
    this.joinGroup(groupId)
  }

  onMessageSend() {
    this.sendMessage()
  }

  onMessageInputChange(value: string) {
    this.inputMensagem = value
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.sendMessage()
    }
  }

  scrollToBottom() {
    setTimeout(() => {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop =
          this.messagesContainer.nativeElement.scrollHeight;
      }
    }, 100);
  }

  selectChat(type: string, id: string, name: string) {
    this.selectedChat = { type, id, name }
    this.chatService.setCurrentChat(type, id)
    this.updateCurrentChatMessages()
  }

  private updateUserChats() {
    this.userChats = this.users
      .filter((u) => u.username !== this.username)
      .map((u) => ({
        id: u.username,
        name: u.username,
        online: u.online,
        lastSeen: u.online ? null : this.formatLastSeen(u.lastSeen),
        unread: 0
      }))
  }

  private updateGroupChats() {
    this.groupChats = this.groups
      .filter((g) => g.members.includes(this.username))
      .map((g) => ({
        id: g.id,
        name: g.name,
        leader: g.leader,
        members: g.members.length,
        unread: 0,
        createdAt: new Date()
      }))

    this.availableGroups = this.groups
      .filter((g) => !g.members.includes(this.username))
      .map((g) => ({
        id: g.id,
        name: g.name,
        leader: g.leader,
        members: g.members.length,
        description: `Grupo criado por ${g.leader}`
      }))
  }

  private updateCurrentChatMessages() {
    if (!this.selectedChat) {
      this.messages = []
      return
    }

    const chatMessages = this.chatService.getMessagesForChat(
      this.selectedChat.type,
      this.selectedChat.id
    )

    this.messages = chatMessages.map((m) => ({
      id: m.id,
      sender: m.sender,
      content: m.content,
      timestamp: this.formatTime(m.timestamp),
      fromCurrentUser: m.fromCurrentUser
    }))

    this.scrollToBottom()
  }

  getSelectedUserStatus(): string {
    if (this.selectedChat?.type === 'user') {
      const user = this.userChats.find((u) => u.id === this.selectedChat?.id)
      return user?.online ? 'Online' : `Visto ${user?.lastSeen}`
    }
    return ''
  }

  sendMessage() {
    if (!this.inputMensagem.trim() || !this.selectedChat) return

    if (this.selectedChat.type === 'user') {
      this.chatService.sendUserMessage(this.username, this.selectedChat.id, this.inputMensagem)
    } else if (this.selectedChat.type === 'group') {
      this.chatService.sendGroupMessage(this.selectedChat.id, this.username, this.inputMensagem)
    }

    this.inputMensagem = ''
  }

  acceptInvite(invitation: GroupInvitation) {
    this.invitationService.acceptInvitation(invitation, this.username)
  }

  rejectInvite(invitation: GroupInvitation) {
    this.invitationService.rejectInvitation(invitation, this.username)
  }

  joinGroup(groupId: string) {
    const group = this.groups.find((g) => g.id === groupId)
    if (!group) return

    group.members.push(this.username)
    this.mqttService.publish('meu-chat-mqtt/groups', JSON.stringify(group), true)
  }

  private formatLastSeen(date: Date): string {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)

    if (minutes < 1) return 'agora'
    if (minutes < 60) return `${minutes} min atrás`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h atrás`

    const days = Math.floor(hours / 24)
    return `${days}d atrás`
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
}
