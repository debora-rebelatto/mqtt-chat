import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  OnInit,
  OnDestroy
} from '@angular/core'
import { FormsModule } from '@angular/forms'
import { CommonModule } from '@angular/common'
import { Subscription } from 'rxjs'

import { MqttService } from '../../services/mqtt.service'
import { UserService } from '../../services/user.service'
import { GroupService } from '../../services/group.service'
import { UserListComponent } from '../user-list/user-list.component'
import { GroupListComponent } from '../group-list/group-list.component'
import { MessageInputComponent } from '../message-input/message-input.component'
import { DateFormatPipe } from '../../pipe/date-format.pipe'

@Component({
  selector: 'app-chat-container',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    GroupListComponent,
    UserListComponent,
    MessageInputComponent
],
  templateUrl: './chat-container.component.html'
})
export class ChatContainerComponent implements AfterViewChecked, OnInit, OnDestroy {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef

  username: string = ''
  messages: string[] = []
  connected: boolean = false
  showCreateGroupModal: boolean = false
  newGroupName: string = ''

  onlineUsers: any[] = []
  groups: any[] = []

  private shouldScrollToBottom: boolean = true
  private userSubscription!: Subscription
  private groupSubscription!: Subscription
  private heartbeatInterval: any = null
  private clientId: string = ''

  constructor(
    private mqttService: MqttService,
    private userService: UserService,
    private groupService: GroupService
  ) {}

  ngOnInit() {
    this.userSubscription = this.userService.users$.subscribe((users) => {
      this.onlineUsers = users
    })

    this.groupSubscription = this.groupService.groups$.subscribe((groups) => {
      this.groups = groups
    })
  }

  ngOnDestroy() {
    this.userSubscription?.unsubscribe()
    this.groupSubscription?.unsubscribe()
    this.disconnect()
  }

  ngAfterViewChecked() {
    this.scrollToBottom()
  }

  // ============ CONEXÃO ============
  async connect() {
    if (!this.username.trim()) {
      alert('Digite um nome!')
      return
    }

    try {
      this.clientId = `chat_${this.username}_${Math.random().toString(16).substring(2, 8)}`

      await this.mqttService.connect('test.mosquitto.org', 8080, this.clientId)
      this.connected = true

      // Inicializa serviços
      this.userService.initialize(this.clientId, this.username)
      this.groupService.initialize()

      // Configura subscriptions
      this.setupSubscriptions()

      // Publica status inicial
      this.userService.publishOnlineStatus(this.username)
      this.userService.requestSync(this.username)
      this.requestHistory()

      this.startHeartbeat()
      this.shouldScrollToBottom = true
    } catch (error) {
      this.connected = false
      alert('Falha ao conectar ao broker MQTT')
    }
  }

  private setupSubscriptions() {
    this.mqttService.subscribe('meu-chat-mqtt/sala-geral', (message) => {
      this.messages.push(message)
      this.shouldScrollToBottom = true
    })

    this.mqttService.subscribe('meu-chat-mqtt/sala-geral/history', (message) => {
      this.processHistoryMessage(message)
    })
  }

  disconnect() {
    if (this.connected) {
      this.userService.publishOfflineStatus(this.username)
      this.mqttService.disconnect()

      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval)
      }

      this.connected = false
      this.onlineUsers = this.onlineUsers.filter((user) => user.username !== this.username)
    }
  }

  // ============ MENSAGENS ============
  onMessageSent(message: string) {
    if (!this.connected) return

    const formattedMessage = `${this.username}: ${message}`
    this.messages.push(formattedMessage)
    this.shouldScrollToBottom = true

    this.mqttService.publish('meu-chat-mqtt/sala-geral', formattedMessage)
    this.updateRetainedHistory()
  }

  private updateRetainedHistory() {
    const recentHistory = this.messages.slice(-50)
    this.mqttService.publish(
      'meu-chat-mqtt/sala-geral/history',
      JSON.stringify(recentHistory),
      true
    )
  }

  private requestHistory() {
    this.mqttService.publish('meu-chat-mqtt/sala-geral/history', 'REQUEST_HISTORY')
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

  clearHistory() {
    if (!this.connected) {
      alert('Não conectado ao chat!')
      return
    }

    if (!confirm('Tem certeza que deseja limpar todo o histórico do chat?')) {
      return
    }

    this.mqttService.publish('meu-chat-mqtt/sala-geral/history', '[]', true)
    this.messages = []
    this.messages.push(`💬 ${this.username} limpou o histórico do chat`)
    this.shouldScrollToBottom = true
  }

  // ============ GRUPOS ============
  onCreateGroup() {
    this.showCreateGroupModal = true
  }

  createGroup() {
    if (!this.newGroupName.trim()) {
      alert('Digite um nome para o grupo')
      return
    }

    const newGroup = this.groupService.createGroup(this.newGroupName, this.username)

    this.newGroupName = ''
    this.showCreateGroupModal = false

    this.messages.push(`💬 ${this.username} criou o grupo "${newGroup.name}"`)
    this.shouldScrollToBottom = true
  }

  onModalKeyPress(event: KeyboardEvent) {
    event.stopPropagation()
  }

  // ============ HEARTBEAT ============
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.connected) {
        const heartbeatMessage = {
          type: 'heartbeat',
          username: this.username,
          clientId: this.clientId,
          timestamp: Date.now()
        }

        this.mqttService.publish('meu-chat-mqtt/heartbeat', JSON.stringify(heartbeatMessage))
      }
    }, 30000)
  }

  // ============ UTILITÁRIOS ============
  get onlineUsersCount(): number {
    return this.userService.getOnlineUsersCount()
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
}
