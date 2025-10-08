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
  private pendingMessages: Map<string, Message[]> = new Map()

  private readonly MESSAGES_STORAGE_KEY = 'mqtt-chat-messages'
  private readonly PENDING_MESSAGES_KEY = 'mqtt-chat-pending-messages'

  constructor(
    private mqttService: MqttService,
    private userService: UserService,
    private groupService: GroupService,
    private appState: AppStateService
  ) {
    this.loadMessagesFromStorage()
    this.loadPendingMessagesFromStorage()
    this.setupSubscriptions()
  }

  private setupSubscriptions() {
    this.userService.users$.subscribe((users: User[]) => {
      const oldUsers = this.users
      this.users = users
      this.updateUserChats()

      this.checkForUsersComingOnline(oldUsers, users)
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

  private checkForUsersComingOnline(oldUsers: User[], newUsers: User[]) {
    newUsers.forEach((newUser) => {
      const oldUser = oldUsers.find((u) => u.id === newUser.id)
      if (oldUser && !oldUser.online && newUser.online) {
        this.sendPendingMessagesToUser(newUser.id)
      }
    })
  }

  private sendPendingMessagesToUser(userId: string) {
    const pending = this.pendingMessages.get(userId)
    if (pending && pending.length > 0) {
      const messagesToSend = [...pending]

      this.pendingMessages.delete(userId)
      this.savePendingMessagesToStorage()

      messagesToSend.forEach((message, index) => {
        const mqttPayload = {
          id: message.id,
          sender: message.sender.id,
          content: message.content,
          timestamp: message.timestamp.toISOString(),
          chatType: ChatType.User,
          chatId: message.chatId,
          isOfflineMessage: true
        }

        setTimeout(() => {
          const success = this.mqttService.publish(`meu-chat-mqtt/messages/${userId}`, JSON.stringify(mqttPayload), false, 1)
          if (!success) {
            this.addPendingMessage(userId, message)
          }
        }, index * 200)
      })
    }
  }
  private addPendingMessage(toUserId: string, message: Message) {
    if (!this.pendingMessages.has(toUserId)) {
      this.pendingMessages.set(toUserId, [])
    }
    this.pendingMessages.get(toUserId)!.push(message)
    this.savePendingMessagesToStorage()
  }

  private loadPendingMessagesFromStorage() {
    const stored = localStorage.getItem(this.PENDING_MESSAGES_KEY)
    if (stored) {
      const pendingData = JSON.parse(stored)
      Object.entries(pendingData).forEach(([userId, messages]: [string, any]) => {
        const parsedMessages = messages.map((msgData: any) => {
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
        this.pendingMessages.set(userId, parsedMessages)
      })
    }
  }

  private savePendingMessagesToStorage() {
    const pendingData: { [key: string]: any[] } = {}
    this.pendingMessages.forEach((messages, userId) => {
      pendingData[userId] = messages.map((msg) => ({
        id: msg.id,
        sender: {
          id: msg.sender.id,
          name: msg.sender.name,
          online: msg.sender.online,
          lastSeen: msg.sender.lastSeen
        },
        content: msg.content,
        timestamp: msg.timestamp,
        chatType: msg.chatType,
        chatId: msg.chatId
      }))
    })
    localStorage.setItem(this.PENDING_MESSAGES_KEY, JSON.stringify(pendingData))
  }

  initialize(username: string) {
    this.mqttService.subscribe(`meu-chat-mqtt/messages/${username}`, (message) => {
      this.handleUserMessage(message, username)
    })

    this.mqttService.subscribe('meu-chat-mqtt/messages/groups', (message) => {
      this.handleGroupMessage(message)
    })

    this.mqttService.subscribe(`meu-chat-mqtt/confirmations/${username}`, (message) => {
      this.handleMessageConfirmation(message)
    })

    this.requestMissedMessages(username)

    setInterval(() => {
      if (!this.mqttService.isConnected()) {
        this.mqttService.forceResubscribe()
      }
    }, 10000)

    setTimeout(() => {
      this.checkPendingMessagesForOnlineUsers()
    }, 3000)
  }

  private requestMissedMessages(username: string) {
    const syncRequest = {
      type: 'sync_request',
      userId: username,
      timestamp: new Date().toISOString(),
      lastSeen: this.getLastMessageTimestamp(username)
    }
    
    this.mqttService.publish(`meu-chat-mqtt/sync/${username}`, JSON.stringify(syncRequest), false, 1)
  }

  private getLastMessageTimestamp(username: string): string {
    const userMessages = this.messagesSubject.value.filter(
      msg => msg.chatType === ChatType.User && 
      (msg.sender.id === username || msg.chatId === username)
    )
    
    if (userMessages.length > 0) {
      const lastMessage = userMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]
      return lastMessage.timestamp.toISOString()
    }
    
    return new Date(0).toISOString()
  }

  private checkPendingMessagesForOnlineUsers() {
    this.users.forEach((user) => {
      if (user.online && user.id !== this.appState.user?.id) {
        this.sendPendingMessagesToUser(user.id)
      }
    })
  }

  private handleUserMessage(message: string, currentUsername: string) {
    const messageData = JSON.parse(message)

    const senderId =
      typeof messageData.sender === 'string' ? messageData.sender : messageData.sender.id

    if (messageData.chatId !== currentUsername) {
      return
    }

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

    this.addMessage(chatMessage)

    if (messageData.isOfflineMessage) {
      this.confirmOfflineMessageReceived(messageData.id, senderId)
    }
  }

  private confirmOfflineMessageReceived(messageId: string, senderId: string) {
    const confirmation = {
      type: 'message_received',
      messageId: messageId,
      receivedBy: this.appState.user?.id,
      timestamp: new Date().toISOString()
    }
    
    this.mqttService.publish(`meu-chat-mqtt/confirmations/${senderId}`, JSON.stringify(confirmation), false, 1)
  }

  private handleMessageConfirmation(message: string) {
    const confirmation = JSON.parse(message)
    
    if (confirmation.type === 'message_received') {
      this.removePendingMessage(confirmation.messageId, confirmation.receivedBy)
    }
  }

  private removePendingMessage(messageId: string, userId: string) {
    const pending = this.pendingMessages.get(userId)
    if (pending) {
      const filteredMessages = pending.filter(msg => msg.id !== messageId)
      if (filteredMessages.length !== pending.length) {
        this.pendingMessages.set(userId, filteredMessages)
        this.savePendingMessagesToStorage()
      }
    }
  }

  private handleGroupMessage(message: string) {
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

  private saveMessagesToStorage(messages: Message[]) {

      const messagesData = messages.map((msg) => ({
        id: msg.id,
        sender: {
          id: msg.sender.id,
          name: msg.sender.name,
          online: msg.sender.online,
          lastSeen: msg.sender.lastSeen
        },
        content: msg.content,
        timestamp: msg.timestamp,
        chatType: msg.chatType,
        chatId: msg.chatId
      }))

      localStorage.setItem(this.MESSAGES_STORAGE_KEY, JSON.stringify(messagesData))

  }

  private loadMessagesFromStorage() {
    const stored = localStorage.getItem(this.MESSAGES_STORAGE_KEY)
    if (stored) {
      try {
        const messagesData = JSON.parse(stored)
        const messages = messagesData.map((msgData: any) => {
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
      } catch (error) {
        console.error('Erro ao carregar mensagens do localStorage:', error)
        localStorage.removeItem(this.MESSAGES_STORAGE_KEY)
      }
    }
  }

  sendUserMessage(from: User, to: User, content: string) {
    const messageId = `msg_${Date.now()}_${Math.random().toString(16).substring(2, 8)}`

    const message: Message = new Message(messageId, from, content, new Date(), ChatType.User, to.id)

    this.addMessage(message)

    const mqttPayload = {
      id: message.id,
      sender: from.id,
      content: message.content,
      timestamp: message.timestamp.toISOString(),
      chatType: ChatType.User,
      chatId: to.id
    }

    const targetUser = this.users.find((u) => u.id === to.id)

    if (targetUser && targetUser.online) {
      const success = this.mqttService.publish(`meu-chat-mqtt/messages/${to.id}`, JSON.stringify(mqttPayload), false, 1)
      if (!success) {
        this.addPendingMessage(to.id, message)
      }
    } else {
      this.addPendingMessage(to.id, message)
    }
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

    const mqttPayload = {
      id: message.id,
      sender: from.id,
      content: message.content,
      timestamp: message.timestamp.toISOString(),
      chatType: ChatType.Group,
      chatId: groupId
    }

    this.mqttService.publish('meu-chat-mqtt/messages/groups', JSON.stringify(mqttPayload))
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

    const currentMessages = this.getMessagesForChat(type, id)
    if (currentMessages.length === 0) {
      setTimeout(() => {
        this.updateCurrentChatMessages()
      }, 100)
    }
  }

  subscribeToGroup(groupId: string) {
    this.mqttService.subscribe(`meu-chat-mqtt/groups/${groupId}`, (message) => {
      this.handleGroupMessage(message)
    })
  }

  getMessagesForChat(type: ChatType, targetUserId: string): Message[] {
    const currentUser = this.appState.user
    if (!currentUser) return []

    const allMessages = this.messagesSubject.value

    const filtered = allMessages.filter((message) => {
      if (message.chatType !== type) return false

      if (type === ChatType.User) {
        const userA = currentUser.id
        const userB = targetUserId

        const fromUserAToUserB = message.sender.id === userA && message.chatId === userB
        const fromUserBToUserA = message.sender.id === userB && message.chatId === userA

        const match = fromUserAToUserB || fromUserBToUserA

        return match
      } else {
        return message.chatId === targetUserId
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
      this.subscribeToGroup(group.id)
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
    this.pendingMessages.clear()
    localStorage.removeItem(this.PENDING_MESSAGES_KEY)
    localStorage.removeItem(this.MESSAGES_STORAGE_KEY)
  }

  reloadHistory() {
    this.loadMessagesFromStorage()
    this.updateCurrentChatMessages()
  }

  checkStoredMessages() {
    const stored = localStorage.getItem(this.MESSAGES_STORAGE_KEY)
    const count = stored ? JSON.parse(stored).length : 0
    return count
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

  getPendingMessagesInfo(): { total: number; byUser: { [userId: string]: number } } {
    let total = 0
    const byUser: { [userId: string]: number } = {}

    this.pendingMessages.forEach((messages, userId) => {
      byUser[userId] = messages.length
      total += messages.length
    })

    return { total, byUser }
  }

  forceSendPendingMessages(userId: string) {
    this.sendPendingMessagesToUser(userId)
  }

  forceDeliverPendingMessages(userId?: string) {
    if (userId) {
      this.sendPendingMessagesToUser(userId)
    } else {
      this.pendingMessages.forEach((messages, userId) => {
        if (messages.length > 0) {
          this.sendPendingMessagesToUser(userId)
        }
      })
    }
  }

  debugCurrentState() {
    const currentUser = this.appState.user
    const allMessages = this.messagesSubject.value
    const selectedChat = this.appState.selectedChat

    return {
      currentUser: currentUser?.id,
      selectedChat: selectedChat?.id,
      totalMessages: allMessages.length,
      pendingMessages: this.getPendingMessagesInfo()
    }
  }
}
