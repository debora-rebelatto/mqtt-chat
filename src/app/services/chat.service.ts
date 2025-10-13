import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { MqttService } from './mqtt.service'
import { User, Group, Message, ChatType } from '../models'
import { AppStateService } from './app-state.service'
import { GroupService } from './group.service'
import { UserService } from './user.service'
import { PendingMessagesService } from './pending-messages.service'
import { MqttTopics } from '../config/mqtt-topics'

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

  constructor(
    private mqttService: MqttService,
    private userService: UserService,
    private groupService: GroupService,
    private appState: AppStateService,
    private pendingMessagesService: PendingMessagesService
  ) {
    this.setupSubscriptions()
  }

  private setupSubscriptions(): void {
    this.userService.users$.subscribe((users: User[]) => {
      const oldUsers = this.users
      this.users = users
      this.updateUserChats()
      this.checkForUsersComingOnline(oldUsers, users)
    })

    this.groupService.groups$.subscribe((groups: Group[]) => {
      this.groups = groups
      this.updateGroupChats()
      this.updateAvailableGroups()
      this.subscribeToUserGroups(groups)
    })

    this.messages$.subscribe((messages: Message[]) => {
      this.allMessages = messages
      this.updateUserChats()
      this.updateCurrentChatMessages()
    })

    this.appState.selectedChat$.subscribe(() => {
      this.updateCurrentChatMessages()
    })
  }

  private updateGroupChats(): void {
    const currentUser = this.appState.user
    if (!currentUser) {
      this.groupChatsSubject.next([])
      return
    }

    const userGroups = this.groups.filter((group) =>
      group.members.some((member) => member.id === currentUser.id)
    )

    this.groupChatsSubject.next(userGroups)
  }

  private checkForUsersComingOnline(oldUsers: User[], newUsers: User[]): void {
    newUsers.forEach((newUser) => {
      const oldUser = oldUsers.find((u) => u.id === newUser.id)
      if (oldUser && !oldUser.online && newUser.online) {
        this.pendingMessagesService.sendPendingMessagesToUser(newUser.id)
      }
    })
  }

  initialize(): void {
    const currentUser = this.appState.user!

    if (currentUser) {
      this.groupService.setCurrentUser(currentUser)
      this.groupService.initialize()
    }

    this.mqttService.subscribe(MqttTopics.messages.privateMessage(currentUser.name), (message) => {
      this.handleUserMessage(message, currentUser.name)
    })

    this.mqttService.subscribe(MqttTopics.messages.groupMessages, (message) => {
      this.handleGroupMessage(message)
    })

    this.mqttService.subscribe(MqttTopics.invitation.confirmation(currentUser.name), (message) => {
      this.handleMessageConfirmation(message)
    })

    this.requestMissedMessages(currentUser.name)

    setInterval(() => {
      if (!this.mqttService.isConnected()) {
        this.mqttService.forceResubscribe()
      }
    }, 10000)

    setTimeout(() => {
      this.checkPendingMessagesForOnlineUsers()
    }, 3000)
  }

  private requestMissedMessages(username: string): void {
    const syncRequest = {
      type: 'sync_request',
      userId: username,
      timestamp: new Date().toISOString(),
      lastSeen: this.getLastMessageTimestamp(username)
    }

    this.mqttService.publish(
      MqttTopics.sync.syncByUser(username),
      JSON.stringify(syncRequest),
      false,
      1
    )
  }

  private getLastMessageTimestamp(username: string): string {
    const userMessages = this.messagesSubject.value.filter(
      (msg) =>
        msg.chatType === ChatType.User && (msg.sender.id === username || msg.chatId === username)
    )

    const latestMessage = this.getLatestMessage(userMessages)
    return latestMessage ? latestMessage.timestamp.toISOString() : new Date(0).toISOString()
  }

  private checkPendingMessagesForOnlineUsers(): void {
    this.users.forEach((user) => {
      if (user.online && user.id !== this.appState.user?.id) {
        this.pendingMessagesService.sendPendingMessagesToUser(user.id)
      }
    })
  }

  private handleUserMessage(message: string, currentUsername: string): void {
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

  private confirmOfflineMessageReceived(messageId: string, senderId: string): void {
    const confirmation = {
      type: 'message_received',
      messageId: messageId,
      receivedBy: this.appState.user?.id,
      timestamp: new Date().toISOString()
    }

    this.mqttService.publish(
      MqttTopics.invitation.confirmation(senderId),
      JSON.stringify(confirmation),
      false,
      1
    )
  }

  private handleMessageConfirmation(message: string): void {
    const confirmation = JSON.parse(message)

    if (confirmation.type === 'message_received') {
      this.pendingMessagesService.removePendingMessage(
        confirmation.messageId,
        confirmation.receivedBy
      )
    }
  }

  private handleGroupMessage(message: string): void {
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
  private addMessage(message: Message): void {
    const currentMessages = this.messagesSubject.value
    const messageExists = currentMessages.some((m) => m.id === message.id)

    if (!messageExists) {
      const updatedMessages = [...currentMessages, message]
      this.messagesSubject.next(updatedMessages)
    }
  }

  sendUserMessage(from: User, to: User, content: string): void {
    if (!content.trim()) return

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
      const success = this.mqttService.publish(
        MqttTopics.messages.privateMessage(to.id),
        JSON.stringify(mqttPayload),
        false,
        1
      )

      if (!success) {
        this.pendingMessagesService.addPendingMessage(to.id, message)
      }
    } else {
      this.pendingMessagesService.addPendingMessage(to.id, message)
    }
  }

  sendGroupMessage(groupId: string, from: User, content: string): void {
    if (!content.trim()) return

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

    this.mqttService.publish(MqttTopics.groups.specificGroup(groupId), JSON.stringify(mqttPayload))
  }

  subscribeToGroup(groupId: string): void {
    this.mqttService.subscribe(MqttTopics.groups.specificGroup(groupId), (message) => {
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

        return fromUserAToUserB || fromUserBToUserA
      } else {
        return message.chatId === targetUserId
      }
    })

    return this.sortMessagesByTimestamp(filtered, false)
  }

  private updateUserChats(): void {
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
      .filter((u) => u.id !== currentUser.id && u.online)
      .map((u) => new User(u.id, u.name, u.online, new Date()))
  }

  private getOfflineUsersWithChats(currentUser: User, onlineUsers: User[]): User[] {
    const usersWithMessages = this.getUsersWithMessages()
    const onlineUserIds = new Set(onlineUsers.map((u) => u.id))

    return Array.from(usersWithMessages)
      .filter((userId) => !onlineUserIds.has(userId))
      .map((userId) => {
        const userMessages = this.getMessagesForUser(userId, currentUser.id)
        const latestMessage = this.getLatestMessage(userMessages)

        return new User(userId, userId, false, latestMessage ? latestMessage.timestamp : new Date())
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

    const userMessages = this.getMessagesForUser(userId, currentUser.id)
    return this.getLatestMessage(userMessages)
  }

  private sortUserChats(a: User, b: User): number {
    if (a.online && !b.online) return -1
    if (!a.online && b.online) return 1

    const aLastMsg = this.getLastMessageForUser(a.id)
    const bLastMsg = this.getLastMessageForUser(b.id)

    if (!aLastMsg && !bLastMsg) return a.name.localeCompare(b.name)
    if (!aLastMsg) return 1
    if (!bLastMsg) return -1

    return bLastMsg.timestamp.getTime() - aLastMsg.timestamp.getTime()
  }

  private updateCurrentChatMessages(): void {
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

  private updateAvailableGroups(): void {
    this.availableGroupsSubject.next(this.groups)
  }

  getPendingMessagesCount(): number {
    return this.pendingMessagesService.getTotalPendingCount()
  }

  getUsersWithPendingMessages(): string[] {
    return this.pendingMessagesService.getUsersWithPendingMessages()
  }

  hasPendingMessagesForUser(userId: string): boolean {
    return this.pendingMessagesService.hasPendingMessages(userId)
  }

  clearMessages(): void {
    this.messagesSubject.next([])
    this.pendingMessagesService.clearAll()
  }

  private sortMessagesByTimestamp(messages: Message[], descending: boolean = true): Message[] {
    return messages.sort((a, b) => {
      const timeA = a.timestamp.getTime()
      const timeB = b.timestamp.getTime()
      return descending ? timeB - timeA : timeA - timeB
    })
  }

  private getLatestMessage(messages: Message[]): Message | undefined {
    if (messages.length === 0) return undefined
    return this.sortMessagesByTimestamp(messages)[0]
  }

  private getMessagesForUser(userId: string, currentUserId: string): Message[] {
    return this.allMessages.filter((msg) => {
      if (msg.chatType !== ChatType.User) return false

      const isFromCurrentUserToTarget = msg.sender.id === currentUserId && msg.chatId === userId
      const isFromTargetToCurrentUser = msg.sender.id === userId && msg.chatId === currentUserId

      return isFromCurrentUserToTarget || isFromTargetToCurrentUser
    })
  }

  getServiceState(): any {
    return {
      users: this.users.length,
      groups: this.groups.length,
      messages: this.messagesSubject.value.length,
      pendingMessages: this.getPendingMessagesCount(),
      currentChat: this.appState.selectedChat
    }
  }

  private subscribeToUserGroups(groups: Group[]): void {
    const currentUser = this.appState.user
    if (!currentUser) return

    groups.forEach((group) => {
      const isMember = group.members.some((member) => member.id === currentUser.id)
      if (isMember) {
        this.mqttService.subscribe(MqttTopics.groups.specificGroup(group.id), (message) => {
          this.handleGroupMessage(message)
        })
      }
    })
  }
}
