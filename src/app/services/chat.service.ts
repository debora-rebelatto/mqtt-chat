import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { MqttService } from './mqtt.service'
import { User, Group, Message, ChatType } from '../models'
import { AppStateService } from './app-state.service'
import { GroupService } from './group.service'
import { UserService } from './user.service'

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private messagesSubject = new BehaviorSubject<Message[]>([])
  public messages$ = this.messagesSubject.asObservable()

  private userChatsSubject = new BehaviorSubject<User[]>([])
  public userChats$ = this.userChatsSubject.asObservable()

  private groupChatsSubject = new BehaviorSubject<Group[]>([])
  public groupChats$ = this.groupChatsSubject.asObservable()

  private availableGroupsSubject = new BehaviorSubject<Group[]>([])
  public availableGroups$ = this.availableGroupsSubject.asObservable()

  private currentMessagesSubject = new BehaviorSubject<Message[]>([])
  public currentMessages$ = this.currentMessagesSubject.asObservable()

  private users: User[] = []
  private groups: Group[] = []
  private allMessages: Message[] = []

  private readonly MESSAGES_STORAGE_KEY = 'mqtt-chat-messages'

  constructor(
    private mqttService: MqttService,
    private userService: UserService,
    private groupService: GroupService,
    private appState: AppStateService
  ) {
    this.loadMessagesFromStorage()
    this.setupSubscriptions()
  }

  private setupSubscriptions() {
    this.userService.users$.subscribe((users: User[]) => {
      this.users = users
      this.updateUserChats()
    })

    this.groupService.groups$.subscribe((groups: Group[]) => {
      this.groups = groups
      this.updateGroupChats()
    })

    this.messages$.subscribe((messages: Message[]) => {
      this.allMessages = messages
      this.updateUserChats()
      this.updateCurrentChatMessages()
    })
  }

  initialize(username: string) {
    this.mqttService.subscribe(`meu-chat-mqtt/messages/${username}`, (message) => {
      this.handleUserMessage(message, username)
    })

    this.mqttService.subscribe('meu-chat-mqtt/messages/groups', (message) => {
      this.handleGroupMessage(message, username)
    })
  }

  private handleUserMessage(message: string, currentUsername: string) {
    console.log('Recebendo mensagem MQTT:', message, 'para usuário:', currentUsername)
    const messageData = JSON.parse(message)

    const senderId =
      typeof messageData.sender === 'string' ? messageData.sender : messageData.sender.id

    const senderUser =
      this.users.find((u) => u.id === senderId) || new User(senderId, senderId, false, new Date())

    const chatMessage: Message = new Message(
      messageData.id,
      senderUser,
      messageData.content,
      new Date(messageData.timestamp),
      ChatType.User,
      messageData.chatId
    )

    console.log('Mensagem processada:', chatMessage)
    this.addMessage(chatMessage)
  }

  private handleGroupMessage(message: string, currentUsername: string) {
    console.log('Recebendo mensagem de grupo:', message, 'usuário atual:', currentUsername)
    const messageData = JSON.parse(message)

    const senderId =
      typeof messageData.sender === 'string' ? messageData.sender : messageData.sender.id

    const senderUser =
      this.users.find((u) => u.id === senderId) || new User(senderId, senderId, false, new Date())

    const chatMessage: Message = new Message(
      messageData.id,
      senderUser,
      messageData.content,
      new Date(messageData.timestamp),
      ChatType.Group,
      messageData.chatId
    )

    this.addMessage(chatMessage)
  }

  private addMessage(message: Message) {
    const currentMessages = this.messagesSubject.value
    const messageExists = currentMessages.some((m) => m.id === message.id)

    if (!messageExists) {
      const updatedMessages = [...currentMessages, message]
      this.messagesSubject.next(updatedMessages)
      this.saveMessagesToStorage(updatedMessages)
    }
  }

  private loadMessagesFromStorage() {
    localStorage.removeItem(this.MESSAGES_STORAGE_KEY)

    const stored = localStorage.getItem(this.MESSAGES_STORAGE_KEY)
    if (stored) {
      const messagesData = JSON.parse(stored)
      const messages = messagesData.map((msgData: Message) => {
        const sender = new User(
          msgData.sender.id,
          msgData.sender.name,
          msgData.sender.online || false,
          msgData.sender.lastSeen ? new Date(msgData.sender.lastSeen) : new Date()
        )

        return new Message(
          msgData.id,
          sender,
          msgData.content,
          new Date(msgData.timestamp),
          msgData.chatType,
          msgData.chatId
        )
      })

      this.messagesSubject.next(messages)
    }
  }

  private saveMessagesToStorage(messages: Message[]) {
    const messagesData = messages.map(
      (msg) => new Message(msg.id, msg.sender, msg.content, msg.timestamp, msg.chatType, msg.chatId)
    )

    localStorage.setItem(this.MESSAGES_STORAGE_KEY, JSON.stringify(messagesData))
  }

  sendUserMessage(from: User, to: User, content: string) {
    const messageId = `msg_${Date.now()}_${Math.random().toString(16).substring(2, 8)}`
    const message: Message = new Message(messageId, from, content, new Date(), ChatType.User, to.id)

    this.addMessage(message)

    this.mqttService.publish(`meu-chat-mqtt/messages/${to.id}`, JSON.stringify(message))
  }

  sendGroupMessage(groupId: string, from: User, content: string) {
    const message: Message = new Message(
      `msg_${Date.now()}_${Math.random().toString(16).substring(2, 8)}`,
      from,
      content,
      new Date(),
      ChatType.Group,
      groupId
    )

    this.addMessage(message)

    this.mqttService.publish('meu-chat-mqtt/messages/groups', JSON.stringify(message))
  }

  setCurrentChat(type: ChatType, id: string, name: string) {
    if (type === ChatType.Group) {
      const group = this.groups.find((g) => g.id === id)
      if (group) {
        name = group.name
      }
    } else if (type === ChatType.User) {
      const user = this.users.find((u) => u.id === id)
      if (user) {
        name = user.name
      }
    }

    this.appState.selectChat(type, id, name)
    this.updateCurrentChatMessages()
  }

  subscribeToGroup(groupId: string, username: string) {
    this.mqttService.subscribe(`meu-chat-mqtt/groups/${groupId}`, (message) => {
      this.handleGroupMessage(message, username)
    })
  }

  getMessagesForChat(type: ChatType, id: string): Message[] {
    const currentUser = this.appState.user
    if (!currentUser) return []

    const allMessages = this.messagesSubject.value

    const filtered = allMessages.filter((message) => {
      if (message.chatType !== type) return false

      if (type === ChatType.User) {
        const isFromCurrentUserToTarget =
          message.sender.id === currentUser.id && message.chatId === id
        const isFromTargetToCurrentUser =
          message.sender.id === id && message.chatId === currentUser.id

        const match = isFromCurrentUserToTarget || isFromTargetToCurrentUser

        return match
      } else {
        return message.chatId === id
      }
    })

    return filtered.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }

  private updateUserChats() {
    const currentUser = this.appState.user
    if (!currentUser) return

    const onlineUsers = this.getOnlineUsers(currentUser)
    const offlineUsersWithChats = this.getOfflineUsersWithChats(currentUser, onlineUsers)

    const userChats = [...onlineUsers, ...offlineUsersWithChats].sort((a, b) =>
      this.sortUserChats(a, b)
    )

    this.userChatsSubject.next(userChats)
  }

  private getOnlineUsers(currentUser: User): User[] {
    return this.users
      .filter((u) => u.id !== currentUser.id)
      .map((u) => new User(u.id, u.name, u.online, u.online ? new Date() : u.lastSeen))
  }

  private getOfflineUsersWithChats(currentUser: User, onlineUsers: User[]): User[] {
    const usersWithMessages = this.getUsersWithMessages()
    const onlineUserIds = new Set(onlineUsers.map((u) => u.id))

    return Array.from(usersWithMessages)
      .filter((userId) => !onlineUserIds.has(userId))
      .map((userId) => {
        const lastMessage = this.allMessages
          .filter(
            (msg) =>
              msg.chatType === ChatType.User && (msg.chatId === userId || msg.sender.id === userId)
          )
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]

        return new User(userId, userId, false, lastMessage ? lastMessage.timestamp : new Date())
      })
  }

  private getUsersWithMessages(): string[] {
    const currentUser = this.appState.user
    if (!currentUser) return []

    const users = new Set<string>()

    this.allMessages.forEach((msg) => {
      if (msg.chatType === ChatType.User) {
        if (msg.sender.id !== currentUser.id) {
          users.add(msg.sender.id)
        }
        if (msg.chatId && msg.chatId !== currentUser.id) {
          users.add(msg.chatId)
        }
      }
    })

    return Array.from(users)
  }

  private getLastMessageForUser(userId: string): Message | undefined {
    const currentUser = this.appState.user
    if (!currentUser) return undefined

    return this.allMessages
      .filter((msg) => {
        if (msg.chatType !== ChatType.User) return false

        const isFromCurrentUserToTarget = msg.sender.id === currentUser.id && msg.chatId === userId
        const isFromTargetToCurrentUser = msg.sender.id === userId && msg.chatId === currentUser.id

        return isFromCurrentUserToTarget || isFromTargetToCurrentUser
      })
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
    const currentUser = this.appState.user
    if (!currentUser) return

    const userGroups = this.groups.filter((g) =>
      g.members.some((member: User) => member.id === currentUser.id)
    )

    const groupChats = userGroups.map(
      (g) => new Group(g.id, g.name, g.leader, g.members, g.createdAt, g.unread)
    )

    this.groupChatsSubject.next(groupChats)

    userGroups.forEach((group) => {
      this.subscribeToGroup(group.id, currentUser.id)
    })

    const availableGroups = this.groups
      .filter((g) => !g.members.some((member: User) => member.id === currentUser.id))
      .map((g) => new Group(g.id, g.name, g.leader, g.members, g.createdAt))

    this.availableGroupsSubject.next(availableGroups)
  }

  private updateCurrentChatMessages() {
    if (!this.appState.selectedChat) {
      this.currentMessagesSubject.next([])
      return
    }

    const chatMessages = this.getMessagesForChat(
      this.appState.selectedChat.type,
      this.appState.selectedChat.id
    )

    this.currentMessagesSubject.next(chatMessages)
  }

  joinGroup(groupId: string) {
    const currentUser = this.appState.user
    if (!currentUser) return

    const group = this.groups.find((g) => g.id === groupId)
    if (!group) return

    const newMember = new User(currentUser.id, currentUser.name, true, new Date())
    group.members.push(newMember)

    this.mqttService.publish(
      'meu-chat-mqtt/groups',
      JSON.stringify({
        ...group,
        members: group.members.map((m) => ({
          id: m.id,
          name: m.name,
          online: m.online,
          lastSeen: m.lastSeen
        }))
      }),
      true
    )
  }

  clearMessages() {
    this.messagesSubject.next([])
  }

  requestConversation(username: string): void {
    const currentUser = this.appState.user
    if (!currentUser) return

    const targetUser = this.users.find((u) => u.name === username)
    if (!targetUser) return

    this.setCurrentChat(ChatType.User, targetUser.id, targetUser.name)

    const greetingMessage = `Olá! Iniciando conversa com ${targetUser.name}`
    this.sendUserMessage(currentUser, targetUser, greetingMessage)
  }
}
