import { Component, ViewChild, ElementRef, AfterViewChecked } from '@angular/core'
import { FormsModule } from '@angular/forms'
import * as Paho from 'paho-mqtt'
import { DateFormatPipe } from './pipe/date-format.pipe'

interface UserStatus {
  username: string
  online: boolean
  lastSeen: Date
  clientId: string
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: true,
  imports: [FormsModule, DateFormatPipe]
})
export class AppComponent implements AfterViewChecked {
  private readonly BROKER_HOST = 'test.mosquitto.org'
  private readonly BROKER_PORT = 8080
  private readonly CHAT_TOPIC = 'meu-chat-mqtt/sala-geral'
  private readonly HISTORY_TOPIC = 'meu-chat-mqtt/sala-geral/history'
  private readonly STATUS_TOPIC = 'meu-chat-mqtt/status'
  private readonly WILL_TOPIC = 'meu-chat-mqtt/status/disconnected'
  private readonly SYNC_TOPIC = 'meu-chat-mqtt/sync'

  private client: Paho.Client | null = null
  username: string = ''
  messages: string[] = []
  inputMensagem: string = ''
  connected: boolean = false
  private isUpdatingHistory: boolean = false
  private clientId: string = ''
  private shouldScrollToBottom: boolean = true
  private syncTimeout: any = null

  onlineUsers: UserStatus[] = []

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef

  get onlineUsersCount(): number {
    return this.onlineUsers.filter((u) => u.online).length
  }

  ngAfterViewChecked() {
    this.scrollToBottom()
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

  connect() {
    if (!this.username.trim()) {
      alert('Digite um nome!')
      return
    }

    this.clientId = `chat_${this.username}_${Math.random().toString(16).substring(2, 8)}`
    this.client = new Paho.Client(this.BROKER_HOST, this.BROKER_PORT, this.clientId)

    this.client.onConnectionLost = (response: Paho.MQTTError) => {
      if (response.errorCode !== 0) {
        this.connected = false
      }
    }

    this.client.onMessageArrived = (message: Paho.Message) => {
      if (message.destinationName === this.CHAT_TOPIC) {
        if (!this.isUpdatingHistory) {
          this.messages.push(message.payloadString)
          this.shouldScrollToBottom = true
        }
      } else if (message.destinationName === this.HISTORY_TOPIC) {
        this.processHistoryMessage(message.payloadString)
      } else if (message.destinationName === this.STATUS_TOPIC) {
        this.processUserStatus(message.payloadString)
      } else if (message.destinationName === this.WILL_TOPIC) {
        this.processUserDisconnect(message.payloadString)
      } else if (message.destinationName === this.SYNC_TOPIC) {
        this.processSyncRequest(message.payloadString)
      }
    }

    const willMessage = new Paho.Message(
      JSON.stringify({
        username: this.username,
        clientId: this.clientId,
        timestamp: new Date(),
        type: 'disconnected'
      })
    )
    willMessage.destinationName = this.WILL_TOPIC

    const connectOptions: Paho.ConnectionOptions = {
      onSuccess: () => {
        this.client!.subscribe(this.CHAT_TOPIC)
        this.client!.subscribe(this.HISTORY_TOPIC)
        this.client!.subscribe(this.STATUS_TOPIC)
        this.client!.subscribe(this.WILL_TOPIC)
        this.client!.subscribe(this.SYNC_TOPIC)

        this.connected = true

        this.cleanDuplicateUsers()
        this.publishOnlineStatus()
        this.requestSync()
        this.requestHistory()

        this.shouldScrollToBottom = true
      },
      onFailure: (error) => {
        this.connected = false
        alert('Falha ao conectar ao broker MQTT')
      },
      willMessage: willMessage,
      timeout: 30,
      keepAliveInterval: 20,
      cleanSession: false
    }

    this.client.connect(connectOptions)
  }

  private requestSync() {
    const syncMessage = {
      type: 'sync_request',
      from: this.username,
      clientId: this.clientId,
      timestamp: new Date()
    }

    const message = new Paho.Message(JSON.stringify(syncMessage))
    message.destinationName = this.SYNC_TOPIC
    this.client!.send(message)

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

  private publishOnlineStatus() {
    const statusMessage = {
      type: 'online',
      username: this.username,
      clientId: this.clientId,
      timestamp: new Date()
    }

    const message = new Paho.Message(JSON.stringify(statusMessage))
    message.destinationName = this.STATUS_TOPIC
    message.retained = false
    this.client!.send(message)
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

  disconnect() {
    if (this.client && this.connected) {
      if (this.syncTimeout) {
        clearTimeout(this.syncTimeout)
      }

      const offlineMessage = {
        type: 'offline',
        username: this.username,
        clientId: this.clientId,
        timestamp: new Date()
      }

      const message = new Paho.Message(JSON.stringify(offlineMessage))
      message.destinationName = this.STATUS_TOPIC
      message.retained = false
      this.client.send(message)

      this.client.disconnect()
      this.connected = false
      this.onlineUsers = this.onlineUsers.filter((user) => user.username !== this.username)
    }
  }

  private requestHistory() {
    const requestMessage = new Paho.Message('REQUEST_HISTORY')
    requestMessage.destinationName = this.HISTORY_TOPIC
    this.client!.send(requestMessage)
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

    const message = new Paho.Message(formattedMessage)
    message.destinationName = this.CHAT_TOPIC
    this.client.send(message)

    this.updateRetainedHistory()

    this.inputMensagem = ''
  }

  private updateRetainedHistory() {
    this.isUpdatingHistory = true

    const recentHistory = this.messages.slice(-50)
    const historyMessage = new Paho.Message(JSON.stringify(recentHistory))
    historyMessage.destinationName = this.HISTORY_TOPIC
    historyMessage.retained = true
    this.client!.send(historyMessage)

    setTimeout(() => {
      this.isUpdatingHistory = false
    }, 100)
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.sendMessage()
    }
  }

  clearHistory() {
    if (!this.client || !this.connected) {
      alert('Não conectado ao chat!')
      return
    }

    if (!confirm('Tem certeza que deseja limpar todo o histórico do chat?')) {
      return
    }

    const emptyHistoryMessage = new Paho.Message('[]')
    emptyHistoryMessage.destinationName = this.HISTORY_TOPIC
    emptyHistoryMessage.retained = true
    this.client.send(emptyHistoryMessage)

    this.messages = []

    this.messages.push(`💬 ${this.username} limpou o histórico do chat`)
    this.shouldScrollToBottom = true
  }
}
