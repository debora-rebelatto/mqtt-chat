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

  username = ''
  messages: string[] = []
  connected = false
  showCreateGroupModal = false
  newGroupName = ''
  onlineUsers: any[] = []
  groups: any[] = []

  private shouldScrollToBottom = true
  private subscriptions: Subscription[] = []
  private heartbeatInterval: any
  private clientId = ''
  private historyLoaded = false

  constructor(
    private mqttService: MqttService,
    private userService: UserService,
    private groupService: GroupService
  ) {}

  ngOnInit() {
    this.subscriptions.push(
      this.userService.users$.subscribe((users) => (this.onlineUsers = users)),
      this.groupService.groups$.subscribe((groups) => (this.groups = groups))
    )
  }

  ngOnDestroy() {
    this.subscriptions.forEach((s) => s?.unsubscribe())
    this.stopHeartbeat()
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom && this.messagesContainer) {
      const el = this.messagesContainer.nativeElement
      el.scrollTop = el.scrollHeight
    }
  }

  async connect() {
    if (!this.username.trim()) {
      alert('Digite um nome!')
      return
    }

    this.clientId = `chat_${this.username}_${Math.random().toString(16).substring(2, 8)}`
    await this.mqttService.connect('test.mosquitto.org', 8080, this.clientId)

    this.connected = true
    this.userService.initialize(this.clientId, this.username)
    this.groupService.initialize()

    this.mqttService.subscribe('meu-chat-mqtt/sala-geral', (msg) => {
      if (!this.messages.includes(msg)) {
        this.messages.push(msg)
        this.shouldScrollToBottom = true
      }
    })

    this.mqttService.subscribe('meu-chat-mqtt/sala-geral/history', (msg) => {
      if (msg && msg !== 'REQUEST_HISTORY') {
        const history = JSON.parse(msg)
        if (Array.isArray(history) && history.length > 0) {
          this.messages = history
          this.historyLoaded = true
          this.shouldScrollToBottom = true
        }
      }
    })

    setTimeout(() => {
      this.userService.publishOnlineStatus(this.username)
      this.userService.requestSync(this.username)
    }, 500)

    this.mqttService.publish('meu-chat-mqtt/sala-geral/history', 'REQUEST_HISTORY')
    this.startHeartbeat()
    this.shouldScrollToBottom = true
  }

  disconnect() {
    if (!this.connected) return

    this.userService.publishOfflineStatus(this.username)
    this.mqttService.disconnect()
    this.stopHeartbeat()
    this.connected = false
    this.historyLoaded = false
    this.onlineUsers = this.onlineUsers.filter((u) => u.username !== this.username)
  }

  onMessageSent(message: string) {
    if (!this.connected || !message.trim()) return

    const msg = `${this.username}: ${message}`
    this.messages.push(msg)
    this.shouldScrollToBottom = true
    this.mqttService.publish('meu-chat-mqtt/sala-geral', msg)

    if (this.historyLoaded) {
      const history = this.messages.slice(-50)
      this.mqttService.publish('meu-chat-mqtt/sala-geral/history', JSON.stringify(history), true)
    }
  }

  clearHistory() {
    if (!this.connected) {
      alert('Não conectado ao chat!')
      return
    }

    if (!confirm('Tem certeza que deseja limpar todo o histórico do chat?')) return

    this.mqttService.publish('meu-chat-mqtt/sala-geral/history', '[]', true)
    this.messages = []

    const msg = `💬 ${this.username} limpou o histórico do chat`
    this.messages.push(msg)
    this.shouldScrollToBottom = true
    this.mqttService.publish('meu-chat-mqtt/sala-geral', msg)
  }

  onCreateGroup() {
    this.showCreateGroupModal = true
  }

  createGroup() {
    if (!this.newGroupName.trim()) {
      alert('Digite um nome para o grupo')
      return
    }

    const group = this.groupService.createGroup(this.newGroupName, this.username)
    this.newGroupName = ''
    this.showCreateGroupModal = false

    const msg = `💬 ${this.username} criou o grupo "${group.name}"`
    this.messages.push(msg)
    this.shouldScrollToBottom = true
    this.mqttService.publish('meu-chat-mqtt/sala-geral', msg)
  }

  closeModal() {
    this.showCreateGroupModal = false
    this.newGroupName = ''
  }

  onModalKeyPress(event: KeyboardEvent) {
    event.stopPropagation()
  }

  onMessagesScroll() {
    if (!this.messagesContainer) return
    const el = this.messagesContainer.nativeElement
    this.shouldScrollToBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50
  }

  get onlineUsersCount(): number {
    return this.userService.getOnlineUsersCount()
  }

  trackByIndex(index: number): number {
    return index
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatInterval = setInterval(() => {
      if (this.connected) {
        const msg = {
          type: 'heartbeat',
          username: this.username,
          clientId: this.clientId,
          timestamp: Date.now()
        }
        this.mqttService.publish('meu-chat-mqtt/heartbeat', JSON.stringify(msg))
      }
    }, 30000)
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }
}
