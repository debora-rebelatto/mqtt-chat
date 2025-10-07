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

  constructor(
    private mqttService: MqttService,
    private userService: UserService,
    private groupService: GroupService,
    private appState: AppStateService
  ) {
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
    console.log('Inicializando ChatService para usuário:', username)
    
    this.mqttService.subscribe(`meu-chat-mqtt/messages/${username}`, (message) => {
      this.handleUserMessage(message, username)
    })

    console.log('Inscrevendo no tópico de mensagens de grupo: meu-chat-mqtt/messages/groups')
    this.mqttService.subscribe('meu-chat-mqtt/messages/groups', (message) => {
      this.handleGroupMessage(message, username)
    })
  }

  private handleUserMessage(message: string, currentUsername: string) {
    console.log('Recebendo mensagem MQTT:', message, 'para usuário:', currentUsername)
    const messageData = JSON.parse(message)

    // Encontrar o usuário correspondente ao sender
    const senderUser =
      this.users.find((u) => u.id === messageData.sender) ||
      new User(messageData.sender, messageData.sender, false, new Date())

    const chatMessage: Message = new Message(
      messageData.id,
      senderUser,
      messageData.content,
      new Date(messageData.timestamp),
      messageData.sender === currentUsername,
      ChatType.User,
      messageData.chatId
    )

    console.log('Mensagem processada:', chatMessage)
    this.addMessage(chatMessage)
  }

  private handleGroupMessage(message: string, currentUsername: string) {
    console.log('Recebendo mensagem de grupo:', message, 'usuário atual:', currentUsername)
    const messageData = JSON.parse(message)

    // Encontrar o usuário correspondente ao sender
    const senderUser =
      this.users.find((u) => u.id === messageData.sender) ||
      new User(messageData.sender, messageData.sender, false, new Date())

    console.log('Sender encontrado:', senderUser.id, 'é mensagem própria?', messageData.sender === currentUsername)

    const chatMessage: Message = new Message(
      messageData.id,
      senderUser,
      messageData.content,
      new Date(messageData.timestamp),
      messageData.sender === currentUsername,
      ChatType.Group, // Usar ChatType.Group em vez de string
      messageData.chatId
    )

    console.log('Adicionando mensagem de grupo:', chatMessage.id, 'para chat:', chatMessage.chatId)
    this.addMessage(chatMessage)
  }

  private addMessage(message: Message) {
    const currentMessages = this.messagesSubject.value
    const messageExists = currentMessages.some((m) => m.id === message.id)

    if (!messageExists) {
      const updatedMessages = [...currentMessages, message]
      this.messagesSubject.next(updatedMessages)
    }
  }

  sendUserMessage(from: User, to: User, content: string) {
    const messageId = `msg_${Date.now()}_${Math.random().toString(16).substring(2, 8)}`
    const message: Message = new Message(
      messageId,
      from,
      content,
      new Date(),
      true,
      ChatType.User,
      to.id // Passar o ID do usuário como string
    )

    this.addMessage(message)
    
    // Criar payload limpo para MQTT
    const mqttPayload = {
      id: messageId,
      sender: from.id,
      content: content,
      timestamp: message.timestamp.toISOString(),
      chatId: to.id,
      chatType: 'user'
    }
    
    console.log('Enviando mensagem MQTT:', mqttPayload)
    this.mqttService.publish(`meu-chat-mqtt/messages/${to.id}`, JSON.stringify(mqttPayload))
  }

  sendGroupMessage(groupId: string, from: User, content: string) {
    console.log('Enviando mensagem para grupo:', groupId, 'de:', from.id, 'conteúdo:', content)
    
    const message: Message = new Message(
      `msg_${Date.now()}_${Math.random().toString(16).substring(2, 8)}`,
      from,
      content,
      new Date(),
      true,
      ChatType.Group,
      groupId
    )

    this.addMessage(message)
    
    const mqttPayload = {
      id: message.id,
      sender: from.id,
      content: content,
      timestamp: message.timestamp.toISOString(),
      chatId: groupId,
      chatType: 'group'
    }
    
    console.log('Publicando mensagem de grupo via MQTT:', mqttPayload)
    this.mqttService.publish('meu-chat-mqtt/messages/groups', JSON.stringify(mqttPayload))
  }

  setCurrentChat(type: ChatType, id: string) {
    let name = id // fallback para o ID
    
    if (type === ChatType.Group) {
      const group = this.groups.find(g => g.id === id)
      if (group) {
        name = group.name
      }
    } else if (type === ChatType.User) {
      const user = this.users.find(u => u.id === id)
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

    return this.messagesSubject.value.filter((message) => {
      if (message.chatType !== type) return false
      
      if (type === ChatType.User) {
        // Para conversas entre usuários, incluir mensagens onde:
        // 1. Eu enviei para o usuário (chatId = id do outro usuário)
        // 2. O usuário enviou para mim (sender.id = id do outro usuário)
        return (
          (message.fromCurrentUser && message.chatId === id) ||
          (!message.fromCurrentUser && message.sender.id === id)
        )
      } else {
        // Para grupos, usar a lógica original
        return message.chatId === id
      }
    })
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
              msg.chatType === ChatType.User && (msg.chatId === userId || msg.sender.id === userId) // Comparar com sender.id
          )
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]

        return new User(userId, userId, false, lastMessage ? lastMessage.timestamp : new Date())
      })
  }

  private getUsersWithMessages(): string[] {
    const users = new Set<string>()

    this.allMessages.forEach((msg) => {
      if (msg.chatType === ChatType.User) {
        if (msg.fromCurrentUser) {
          users.add(msg.chatId!)
        } else {
          users.add(msg.sender.id)
        }
      }
    })

    return Array.from(users)
  }

  private getLastMessageForUser(userId: string): Message | undefined {
    return this.allMessages
      .filter(
        (msg) =>
          msg.chatType === ChatType.User && (msg.chatId === userId || msg.sender.id === userId)
      ) // Comparar com sender.id
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

    this.setCurrentChat(ChatType.User, targetUser.id)

    const greetingMessage = `Olá! Iniciando conversa com ${targetUser.name}`
    this.sendUserMessage(currentUser, targetUser, greetingMessage)
  }
}
