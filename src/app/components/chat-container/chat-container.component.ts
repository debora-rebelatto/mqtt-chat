import { Component, OnInit, OnDestroy } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { CommonModule } from '@angular/common'
import { Subject, takeUntil } from 'rxjs'

import { MqttService } from '../../services/mqtt.service'
import { UserService } from '../../services/user.service'
import { GroupService } from '../../services/group.service'
import { ChatService } from '../../services/chat.service'
import { InvitationService } from '../../services/invitation.service'
import { AppStateService } from '../../services/app-state.service'

import { UserStatus } from '../../models/user-status.model'
import { ChatMessage } from '../../models/chat-message.model'
import { GroupInvitation } from '../../models/group-invitation.model'

import { PageHeaderComponent } from '../page-header/page-header.component'
import { SidebarComponent } from '../sidebar/sidebar.component'
import { ChatAreaComponent } from '../chat-area/chat-area.component'
import { AvailableGroup } from '../../models/available-group.model'
import { Group } from '../../models/group.model'
import { UserChats } from '../../models/user-chat.model'
import { GroupChat } from '../../models/group-chat.model'
import { Messages } from '../../models/messages.model'
import { NotificationsBannerComponent } from '../notifications-banner/notifications-banner.component'

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
  private destroy$ = new Subject<void>()

  inputMensagem = ''
  showNotifications = true

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
    public appState: AppStateService
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
      this.updateUserChats()
      this.updateCurrentChatMessages()
    })

    this.invitationService.invitations$.pipe(takeUntil(this.destroy$)).subscribe((invitations) => {
      this.notifications = invitations
    })

    this.appState.selectedChat$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updateCurrentChatMessages()
    })
  }

  onUsernameChange(username: string) {
    this.appState.setUsername(username)
  }

  onConnectionChange(connected: boolean) {
    this.appState.setConnected(connected)
  }

  onGroupCreate(groupName: string) {
    this.groupService.createGroup(groupName, this.appState.username)
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

  selectChat(type: 'user' | 'group', id: string, name: string) {
    this.appState.selectChat(type, id, name)
    this.chatService.setCurrentChat(type, id)
  }

  private updateUserChats() {
    const currentUser = this.appState.username
    const onlineUsers = this.getOnlineUsers(currentUser)
    const offlineUsersWithChats = this.getOfflineUsersWithChats(currentUser, onlineUsers)

    this.userChats = [...onlineUsers, ...offlineUsersWithChats].sort((a, b) =>
      this.sortUserChats(a, b)
    )
  }

  private getOnlineUsers(currentUser: string): UserChats[] {
    return this.users
      .filter((u) => u.username !== currentUser)
      .map((u) => ({
        id: u.username,
        name: u.username,
        online: u.online,
        lastSeen: u.online ? null : this.formatLastSeen(u.lastSeen),
        unread: 0
      }))
  }

  private getOfflineUsersWithChats(currentUser: string, onlineUsers: UserChats[]): UserChats[] {
    const usersWithMessages = this.getUsersWithMessages(currentUser)
    const onlineUserIds = new Set(onlineUsers.map((u) => u.id))

    return Array.from(usersWithMessages)
      .filter((username) => !onlineUserIds.has(username))
      .map((username) => ({
        id: username,
        name: username,
        online: false,
        lastSeen: this.getLastSeenForUser(username),
        unread: 0
      }))
  }

  private getUsersWithMessages(currentUser: string): Set<string> {
    const usersWithMessages = new Set<string>()

    this.allMessages
      .filter((msg) => msg.chatType === 'user')
      .forEach((msg) => {
        if (msg.fromCurrentUser && msg.chatId !== currentUser) {
          usersWithMessages.add(msg.chatId)
        } else if (!msg.fromCurrentUser && msg.sender !== currentUser) {
          usersWithMessages.add(msg.sender)
        }
      })

    return usersWithMessages
  }

  private getLastSeenForUser(username: string): string {
    const lastMessage = this.getLastMessageForUser(username)
    return lastMessage ? this.formatLastSeen(lastMessage.timestamp) : 'Offline'
  }

  private getLastMessageForUser(username: string): ChatMessage | undefined {
    return this.allMessages
      .filter(
        (msg) => msg.chatType === 'user' && (msg.chatId === username || msg.sender === username)
      )
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]
  }

  private sortUserChats(a: UserChats, b: UserChats): number {
    if (a.online && !b.online) return -1
    if (!a.online && b.online) return 1

    const aLastMsg = this.getLastMessageForUser(a.id)
    const bLastMsg = this.getLastMessageForUser(b.id)

    if (!aLastMsg && !bLastMsg) return 0
    if (!aLastMsg) return 1
    if (!bLastMsg) return -1

    return bLastMsg.timestamp.getTime() - aLastMsg.timestamp.getTime()
  }

  private updateGroupChats() {
    const userGroups = this.groups.filter((g) => g.members.includes(this.appState.username))

    this.groupChats = userGroups.map((g) => ({
      id: g.id,
      name: g.name,
      leader: g.leader,
      members: g.members.length,
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

  private updateCurrentChatMessages() {
    if (!this.appState.selectedChat) {
      this.messages = []
      return
    }

    const chatMessages = this.chatService.getMessagesForChat(
      this.appState.selectedChat.type,
      this.appState.selectedChat.id
    )

    this.messages = chatMessages.map((m) => ({
      id: m.id,
      sender: m.sender,
      content: m.content,
      timestamp: this.formatTime(m.timestamp),
      fromCurrentUser: m.fromCurrentUser
    }))
  }

  sendMessage() {
    if (!this.inputMensagem.trim() || !this.appState.selectedChat) return

    if (this.appState.selectedChat.isUser()) {
      this.chatService.sendUserMessage(
        this.appState.username,
        this.appState.selectedChat.id,
        this.inputMensagem
      )
    } else if (this.appState.selectedChat.isGroup()) {
      this.chatService.sendGroupMessage(
        this.appState.selectedChat.id,
        this.appState.username,
        this.inputMensagem
      )
    }

    this.inputMensagem = ''
  }

  acceptInvite(invitation: GroupInvitation) {
    this.invitationService.acceptInvitation(invitation, this.appState.username)
  }

  rejectInvite(invitation: GroupInvitation) {
    this.invitationService.rejectInvitation(invitation, this.appState.username)
  }

  joinGroup(groupId: string) {
    const group = this.groups.find((g) => g.id === groupId)
    if (!group) return

    group.members.push(this.appState.username)
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
