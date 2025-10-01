import { Component, ViewChild, ElementRef, AfterViewChecked } from '@angular/core'
import { FormsModule } from '@angular/forms'
import * as Paho from 'paho-mqtt'
import { DateFormatPipe } from './pipe/date-format.pipe'

// Interfaces
interface UserStatus {
  username: string
  online: boolean
  lastSeen: Date
  clientId: string
}

interface Group {
  id: string
  name: string
  leader: string
  members: string[]
  createdAt: Date
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: true,
  imports: [FormsModule, DateFormatPipe]
})
export class AppComponent implements AfterViewChecked {
  // Constantes
  private readonly BROKER_HOST = 'test.mosquitto.org'
  private readonly BROKER_PORT = 8080
  private readonly TOPICS = {
    CHAT: 'meu-chat-mqtt/sala-geral',
    HISTORY: 'meu-chat-mqtt/sala-geral/history',
    STATUS: 'meu-chat-mqtt/status',
    WILL: 'meu-chat-mqtt/status/disconnected',
    SYNC: 'meu-chat-mqtt/sync',
    GROUPS: 'meu-chat-mqtt/groups',
    HEARTBEAT: 'meu-chat-mqtt/heartbeat'
  }

  // Propriedades privadas
  private client: Paho.Client | null = null
  private clientId: string = ''
  private isUpdatingHistory: boolean = false
  private shouldScrollToBottom: boolean = true
  private syncTimeout: any = null
  private heartbeatInterval: any = null
  private lastSeenMap: Map<string, number> = new Map()

  // Propriedades públicas
  username: string = ''
  messages: string[] = []
  inputMensagem: string = ''
  connected: boolean = false
  onlineUsers: UserStatus[] = []
  groups: Group[] = []
  showCreateGroupModal: boolean = false
  newGroupName: string = ''

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef

  // Getters
  get onlineUsersCount(): number {
    return this.onlineUsers.filter((u) => u.online).length
  }

  // ============ LIFECYCLE METHODS ============
  ngAfterViewChecked() {
    this.scrollToBottom()
  }

  // ============ CONEXÃO MQTT ============
  connect() {
    if (!this.username.trim()) {
      alert('Digite um nome!')
      return
    }

    this.clientId = `chat_${this.username}_${Math.random().toString(16).substring(2, 8)}`
    this.client = new Paho.Client(this.BROKER_HOST, this.BROKER_PORT, this.clientId)

    this.setupEventHandlers()
    this.setupConnection()
  }

  private setupEventHandlers() {
    this.client!.onConnectionLost = (response: Paho.MQTTError) => {
      if (response.errorCode !== 0) {
        this.connected = false
      }
    }

    this.client!.onMessageArrived = (message: Paho.Message) => {
      this.handleIncomingMessage(message)
    }
  }

  private setupConnection() {
    const willMessage = new Paho.Message(
      JSON.stringify({
        username: this.username,
        clientId: this.clientId,
        timestamp: new Date(),
        type: 'disconnected'
      })
    )
    willMessage.destinationName = this.TOPICS.WILL

    const connectOptions: Paho.ConnectionOptions = {
      onSuccess: () => this.onConnectionSuccess(),
      onFailure: () => this.onConnectionFailure(),
      willMessage: willMessage,
      timeout: 30,
      keepAliveInterval: 20,
      cleanSession: false
    }

    this.client!.connect(connectOptions)
  }

  private onConnectionSuccess() {
    this.subscribeToTopics()
    this.connected = true

    this.initializeSystems()
    this.shouldScrollToBottom = true
  }

  private onConnectionFailure() {
    this.connected = false
    alert('Falha ao conectar ao broker MQTT')
  }

  private subscribeToTopics() {
    Object.values(this.TOPICS).forEach((topic) => {
      this.client!.subscribe(topic)
    })
  }

  private initializeSystems() {
    this.startHeartbeat()
    this.cleanDuplicateUsers()
    this.publishOnlineStatus()
    this.requestSync()
    this.requestGroups()
  }

  disconnect() {
    if (!this.client || !this.connected) return

    this.cleanupTimers()
    this.publishOfflineStatus()
    this.client.disconnect()

    this.connected = false
    this.onlineUsers = this.onlineUsers.filter((user) => user.username !== this.username)
  }

  private cleanupTimers() {
    if (this.syncTimeout) clearTimeout(this.syncTimeout)
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval)
    this.lastSeenMap.delete(this.username)
  }

  // ============ MANIPULAÇÃO DE MENSAGENS ============
  private handleIncomingMessage(message: Paho.Message) {
    const handlers = {
      [this.TOPICS.CHAT]: () => this.handleChatMessage(message),
      [this.TOPICS.HISTORY]: () => this.handleHistoryMessage(message),
      [this.TOPICS.STATUS]: () => this.handleStatusMessage(message),
      [this.TOPICS.WILL]: () => this.handleDisconnectMessage(message),
      [this.TOPICS.SYNC]: () => this.handleSyncMessage(message),
      [this.TOPICS.GROUPS]: () => this.handleGroupMessage(message),
      [this.TOPICS.HEARTBEAT]: () => this.handleHeartbeatMessage(message)
    }

    const handler = handlers[message.destinationName]
    if (handler) handler()
  }

  private handleChatMessage(message: Paho.Message) {
    if (!this.isUpdatingHistory) {
      this.messages.push(message.payloadString)
      this.shouldScrollToBottom = true
    }
  }

  private handleHistoryMessage(message: Paho.Message) {
    this.processHistoryMessage(message.payloadString)
  }

  private handleStatusMessage(message: Paho.Message) {
    this.processUserStatus(message.payloadString)
  }

  private handleDisconnectMessage(message: Paho.Message) {
    this.processUserDisconnect(message.payloadString)
  }

  private handleSyncMessage(message: Paho.Message) {
    this.processSyncRequest(message.payloadString)
  }

  private handleGroupMessage(message: Paho.Message) {
    this.processGroupsMessage(message.payloadString)
  }

  private handleHeartbeatMessage(message: Paho.Message) {
    this.processHeartbeat(message.payloadString)
  }

  // ============ SISTEMA DE MENSAGENS ============
  sendMessage() {
    if (!this.client || !this.connected) {
      alert('Não conectado ao chat!')
      return
    }

    const texto = this.inputMensagem.trim()
    if (!texto) return

    const formattedMessage = `${this.username}: ${texto}`
    this.messages.push(formattedMessage)
    this.shouldScrollToBottom = true

    this.publishMessage(this.TOPICS.CHAT, formattedMessage)
    this.updateRetainedHistory()

    this.inputMensagem = ''
  }

  private publishMessage(topic: string, content: string, retained: boolean = false) {
    const message = new Paho.Message(content)
    message.destinationName = topic
    message.retained = retained
    this.client!.send(message)
  }

  private updateRetainedHistory() {
    this.isUpdatingHistory = true
    const recentHistory = this.messages.slice(-50)

    this.publishMessage(this.TOPICS.HISTORY, JSON.stringify(recentHistory), true)

    setTimeout(() => {
      this.isUpdatingHistory = false
    }, 100)
  }

  clearHistory() {
    if (!this.client || !this.connected) {
      alert('Não conectado ao chat!')
      return
    }

    if (!confirm('Tem certeza que deseja limpar todo o histórico do chat?')) {
      return
    }

    this.publishMessage(this.TOPICS.HISTORY, '[]', true)
    this.messages = []
    this.messages.push(`💬 ${this.username} limpou o histórico do chat`)
    this.shouldScrollToBottom = true
  }

  // ============ SISTEMA DE USUÁRIOS ============
  private publishOnlineStatus() {
    this.lastSeenMap.set(this.username, Date.now())

    const statusMessage = {
      type: 'online',
      username: this.username,
      clientId: this.clientId,
      timestamp: new Date()
    }

    this.publishMessage(this.TOPICS.STATUS, JSON.stringify(statusMessage))
  }

  private publishOfflineStatus() {
    const offlineMessage = {
      type: 'offline',
      username: this.username,
      clientId: this.clientId,
      timestamp: new Date()
    }

    this.publishMessage(this.TOPICS.STATUS, JSON.stringify(offlineMessage))
  }

  private requestSync() {
    const syncMessage = {
      type: 'sync_request',
      from: this.username,
      clientId: this.clientId,
      timestamp: new Date()
    }

    this.publishMessage(this.TOPICS.SYNC, JSON.stringify(syncMessage))

    this.syncTimeout = setTimeout(() => {
      this.publishOnlineStatus()
    }, 1000)
  }

  private processSyncRequest(syncData: string) {
    try {
      const sync = JSON.parse(syncData)
      if (sync.type === 'sync_request' && sync.from !== this.username) {
        this.publishOnlineStatus()
      }
    } catch (e) {}
  }

  private processUserStatus(statusData: string) {
    try {
      const status = JSON.parse(statusData)

      if (status.type === 'online') {
        this.addOrUpdateUser({
          username: status.username,
          online: true,
          lastSeen: new Date(status.timestamp),
          clientId: status.clientId
        })

        if (
          status.username !== this.username &&
          !this.messages.some((msg) => msg.includes(`${status.username} entrou no chat`))
        ) {
          this.messages.push(`💚 ${status.username} entrou no chat`)
          this.shouldScrollToBottom = true
        }
      } else if (status.type === 'offline') {
        this.addOrUpdateUser({
          username: status.username,
          online: false,
          lastSeen: new Date(status.timestamp),
          clientId: status.clientId
        })
      }
    } catch (e) {}
  }

  private processUserDisconnect(disconnectData: string) {
    try {
      const disconnect = JSON.parse(disconnectData)

      this.addOrUpdateUser({
        username: disconnect.username,
        online: false,
        lastSeen: new Date(disconnect.timestamp),
        clientId: disconnect.clientId
      })

      if (disconnect.username !== this.username) {
        this.messages.push(`💔 ${disconnect.username} saiu do chat`)
        this.shouldScrollToBottom = true
      }
    } catch (e) {}
  }

  private addOrUpdateUser(userStatus: UserStatus) {
    const existingIndex = this.onlineUsers.findIndex(
      (user) => user.username === userStatus.username
    )

    if (existingIndex >= 0) {
      this.onlineUsers[existingIndex] = userStatus
    } else {
      this.onlineUsers.push(userStatus)
    }

    // Limpa usuários offline antigos
    const now = new Date().getTime()
    this.onlineUsers = this.onlineUsers.filter(
      (user) => user.online || now - user.lastSeen.getTime() < 120000
    )

    this.onlineUsers.sort((a, b) => {
      if (a.online && !b.online) return -1
      if (!a.online && b.online) return 1
      return a.username.localeCompare(b.username)
    })
  }

  private cleanDuplicateUsers() {
    const usernames = new Set<string>()
    this.onlineUsers = this.onlineUsers.filter((user) => {
      if (usernames.has(user.username)) {
        return false
      }
      usernames.add(user.username)
      return true
    })
  }

  private requestGroups() {
    this.publishMessage(this.TOPICS.GROUPS, 'REQUEST_GROUPS')
  }

  createGroup() {
    if (!this.newGroupName.trim()) {
      alert('Digite um nome para o grupo')
      return
    }

    const groupId = `group_${Date.now()}_${Math.random().toString(16).substring(2, 8)}`

    const newGroup: Group = {
      id: groupId,
      name: this.newGroupName,
      leader: this.username,
      members: [this.username],
      createdAt: new Date()
    }

    this.publishMessage(this.TOPICS.GROUPS, JSON.stringify(newGroup), true)
    this.groups.push(newGroup)

    this.newGroupName = ''
    this.showCreateGroupModal = false

    this.messages.push(`💬 ${this.username} criou o grupo "${newGroup.name}"`)
    this.shouldScrollToBottom = true
  }

  private processGroupsMessage(groupsData: string) {
    if (groupsData === 'REQUEST_GROUPS') return

    try {
      const groupData = JSON.parse(groupsData)

      if (groupData.id && groupData.name && groupData.leader && groupData.members) {
        const existingIndex = this.groups.findIndex((g) => g.id === groupData.id)

        if (existingIndex >= 0) {
          this.groups[existingIndex] = groupData
        } else {
          this.groups.push(groupData)
        }
      }
    } catch (e) {}
  }

  private startHeartbeat() {
    // Publica heartbeat a cada 30 segundos
    this.heartbeatInterval = setInterval(() => {
      if (this.connected) {
        const heartbeatMessage = {
          type: 'heartbeat',
          username: this.username,
          clientId: this.clientId,
          timestamp: Date.now()
        }

        this.publishMessage(this.TOPICS.HEARTBEAT, JSON.stringify(heartbeatMessage))
      }
    }, 30000)

    setInterval(() => {
      this.checkOfflineUsers()
    }, 45000)
  }

  private checkOfflineUsers() {
    const now = Date.now()
    const OFFLINE_THRESHOLD = 90000

    this.onlineUsers.forEach((user) => {
      const lastSeen = this.lastSeenMap.get(user.username)

      if (lastSeen && now - lastSeen > OFFLINE_THRESHOLD && user.online) {
        user.online = false
        user.lastSeen = new Date(lastSeen)

        if (user.username !== this.username) {
          this.messages.push(`💔 ${user.username} ficou offline`)
          this.shouldScrollToBottom = true
        }
      }
    })
  }

  private processHeartbeat(heartbeatData: string) {
    try {
      const heartbeat = JSON.parse(heartbeatData)

      if (heartbeat.type === 'heartbeat') {
        this.lastSeenMap.set(heartbeat.username, heartbeat.timestamp)

        this.addOrUpdateUser({
          username: heartbeat.username,
          online: true,
          lastSeen: new Date(heartbeat.timestamp),
          clientId: heartbeat.clientId
        })
      }
    } catch (e) {}
  }

  private processHistoryMessage(historyData: string) {
    if (historyData && historyData !== 'REQUEST_HISTORY') {
      try {
        const historyMessages = JSON.parse(historyData)
        if (Array.isArray(historyMessages)) {
          this.messages = historyMessages
          this.shouldScrollToBottom = true
        }
      } catch (e) {}
    }
  }

  private scrollToBottom(): void {
    if (this.shouldScrollToBottom && this.messagesContainer) {
      try {
        this.messagesContainer.nativeElement.scrollTop =
          this.messagesContainer.nativeElement.scrollHeight
      } catch (err) {}
    }
  }

  onMessagesScroll() {
    const element = this.messagesContainer.nativeElement
    const atBottom = element.scrollHeight - element.scrollTop === element.clientHeight
    this.shouldScrollToBottom = atBottom
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.sendMessage()
    }
  }

  onModalKeyPress(event: KeyboardEvent) {
    event.stopPropagation()
  }
}
