import { Component, OnInit, OnDestroy } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { CommonModule } from '@angular/common'
import { Subject, takeUntil } from 'rxjs'
import { NotificationsBannerComponent } from '../../../components/notifications-banner/notifications-banner.component'
import { SidebarComponent } from '../../../components/sidebar/sidebar.component'
import {
  GroupInvitation,
  AvailableGroup,
  Group,
  ChatMessage,
  User
} from '../../../models'
import { ChatAreaComponent } from '../chat-area/chat-area.component'
import { formatTime } from '../../../utils/format-time'
import { PageHeaderComponent } from '../../../components/page-header/page-header.component'
import {
  MqttService,
  UserService,
  GroupService,
  ChatService,
  InvitationService,
  AppStateService
} from '../../../services'
import { ChatType } from '../../../models/chat-type.component'

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
  userChats: User[] = []
  groupChats: Group[] = []
  availableGroups: AvailableGroup[] = []
  messages: ChatMessage[] = []

  private users: User[] = []
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

  selectChat(type: ChatType, id: string, name: string) {
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

  private getOnlineUsers(currentUser: string): User[] {
    return this.users
      .filter((u) => u.name !== currentUser)
      .map((u) => ({
        id: u.name,
        name: u.name,
        online: u.online,
        lastSeen: u.online ? null : u.lastSeen,
        unread: 0
      }))
  }

  private getOfflineUsersWithChats(currentUser: string, onlineUsers: User[]): User[] {
    const usersWithMessages = this.getUsersWithMessages(currentUser)
    const onlineUserIds = new Set(onlineUsers.map((u) => u.id))

    return Array.from(usersWithMessages)
      .filter((username) => !onlineUserIds.has(username))
      .map((username) => {
        const lastMessage = this.allMessages
          .filter(
            (msg) => msg.chatType === 'user' && (msg.chatId === username || msg.sender === username)
          )
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]

        return {
          id: username,
          name: username,
          online: false,
          lastSeen: lastMessage ? lastMessage.timestamp : new Date(),
          unread: 0
        }
      })
  }
  private getUsersWithMessages(currentUser: string): Set<string> {
    const usersWithMessages = new Set<string>()

    this.allMessages
      .filter((msg) => msg.chatType === 'user')
      .forEach((msg) => {
        if (msg.fromCurrentUser && msg.chatId !== currentUser) {
          usersWithMessages.add(msg.chatId!)
        } else if (!msg.fromCurrentUser && msg.sender !== currentUser) {
          usersWithMessages.add(msg.sender)
        }
      })

    return usersWithMessages
  }

  private getLastSeenForUser(username: string): string {
    const lastMessage = this.getLastMessageForUser(username)
    return lastMessage ? formatTime(lastMessage.timestamp) : 'Offline'
  }

  private getLastMessageForUser(username: string): ChatMessage | undefined {
    return this.allMessages
      .filter(
        (msg) => msg.chatType === 'user' && (msg.chatId === username || msg.sender === username)
      )
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]
  }

  private sortUserChats(a: User, b: User): number {
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
      timestamp: m.timestamp,
      fromCurrentUser: m.fromCurrentUser,
      chatType: ChatType.Group
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

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
}
