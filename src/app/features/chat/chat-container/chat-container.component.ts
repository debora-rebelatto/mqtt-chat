import { Component, OnInit, OnDestroy } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { CommonModule } from '@angular/common'
import { Subject, takeUntil } from 'rxjs'
import { SidebarComponent } from '../../../components/sidebar/sidebar.component'
import { PageHeaderComponent } from '../../../components/page-header/page-header.component'
import { ChatAreaComponent } from '../chat-area/chat-area.component'
import { Group, Message, User } from '../../../models'
import {
  MqttService,
  UserService,
  GroupService,
  ChatService,
  AppStateService
} from '../../../services'
import { ChatType } from '../../../models/chat-type.component'

@Component({
  selector: 'app-chat-container',
  templateUrl: './chat-container.component.html',
  standalone: true,
  imports: [FormsModule, CommonModule, SidebarComponent, PageHeaderComponent, ChatAreaComponent]
})
export class ChatContainerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>()

  inputMensagem = ''
  userChats: User[] = []
  groupChats: Group[] = []
  availableGroups: Group[] = []
  messages: Message[] = []

  private users: User[] = []
  private groups: Group[] = []
  private allMessages: Message[] = []

  constructor(
    private mqttService: MqttService,
    private userService: UserService,
    private groupService: GroupService,
    private chatService: ChatService,
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

    this.appState.selectedChat$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updateCurrentChatMessages()
    })
  }

  onUserChange(user: User) {
    this.appState.setUser(user)
  }

  onConnectionChange(connected: boolean) {
    this.appState.setConnected(connected)
  }

  onGroupCreate(groupName: string) {
    if (!this.appState.user) return
    this.groupService.createGroup(groupName, this.appState.user)
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
    if (!this.appState.user) return
    
    const currentUser = this.appState.user.name
    const onlineUsers = this.getOnlineUsers(currentUser)
    const offlineUsersWithChats = this.getOfflineUsersWithChats(currentUser, onlineUsers)

    this.userChats = [...onlineUsers, ...offlineUsersWithChats].sort((a, b) =>
      this.sortUserChats(a, b)
    )
  }

  private getOnlineUsers(currentUser: string): User[] {
    return this.users
      .filter((u) => u.name !== currentUser)
      .map((u) => new User(u.name, u.name, u.online, u.online ? new Date() : u.lastSeen))
  }

  private getOfflineUsersWithChats(currentUser: string, onlineUsers: User[]): User[] {
    const usersWithMessages = this.getUsersWithMessages(currentUser)
    const onlineUserIds = new Set(onlineUsers.map((u) => u.id))

    return Array.from(usersWithMessages)
      .filter((username) => !onlineUserIds.has(username))
      .map((username) => {
        const lastMessage = this.allMessages
          .filter(
            (msg) =>
              msg.chatType === 'user' && (msg.chatId === username || msg.sender.name === username)
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
        } else if (!msg.fromCurrentUser && msg.sender.name !== currentUser) {
          usersWithMessages.add(msg.sender.id)
        }
      })

    return usersWithMessages
  }

  private getLastMessageForUser(username: string): Message | undefined {
    return this.allMessages
      .filter(
        (msg) =>
          msg.chatType === 'user' && (msg.chatId === username || msg.sender.name === username)
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
    if (!this.appState.user) return
    
    const userGroups = this.groups.filter((g) =>
      g.members.some((member) => member && member.id === this.appState.user!.name)
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
      .filter((g) => !g.members.some((member) => member && member.id === this.appState.user!.name))
      .map((g) => new Group(g.id, g.name, g.leader, g.members, new Date()))
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
      chatType: m.chatType,
      chatId: m.chatId
    }))
  }

  sendMessage() {
    if (!this.inputMensagem.trim() || !this.appState.selectedChat || !this.appState.user) return

    if (this.appState.selectedChat.isUser()) {
      // Encontrar o usuário de destino baseado no ID do chat selecionado
      const targetUser = this.users.find(u => u.id === this.appState.selectedChat!.id) ||
                        new User(this.appState.selectedChat.id, this.appState.selectedChat.name, false, new Date())
      
      this.chatService.sendUserMessage(
        this.appState.user,
        targetUser,
        this.inputMensagem
      )
    } else if (this.appState.selectedChat.isGroup()) {
      this.chatService.sendGroupMessage(
        this.appState.selectedChat.id,
        this.appState.user,
        this.inputMensagem
      )
    }

    this.inputMensagem = ''
  }

  joinGroup(groupId: string) {
    const group = this.groups.find((g) => g.id === groupId)
    if (!group) return

    const newMember = {
      id: this.appState.user!.name,
      name: this.appState.user!.name,
      online: true,
      lastSeen: new Date()
    }

    group.members.push(newMember)
    this.mqttService.publish('meu-chat-mqtt/groups', JSON.stringify(group), true)
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
}
