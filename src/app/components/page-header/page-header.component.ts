import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { TranslateModule } from '@ngx-translate/core'

import { Subject, takeUntil } from 'rxjs'
import { LucideAngularModule, MessageCircle } from 'lucide-angular'
import { GroupInvitation } from '../../models/group-invitation.model'
import { Group } from '../../models/group.model'
import { NotificationsPanelComponent } from '../notifications-panel/notifications-panel.component'
import {
  MqttService,
  UserService,
  GroupService,
  ChatService,
  InvitationService,
  ConnectionManagerService,
  AppStateService
} from '../../services'
import { User } from '../../models'

@Component({
  selector: 'app-page-header',
  templateUrl: './page-header.component.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NotificationsPanelComponent,
    LucideAngularModule,
    TranslateModule
  ]
})
export class PageHeaderComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>()
  readonly MessageCircle = MessageCircle

  isConnecting = false
  showNotifications = false
  notifications: GroupInvitation[] = []
  private _username = ''

  @Output() usernameChange = new EventEmitter<string>()
  @Output() connectionChange = new EventEmitter<boolean>()

  constructor(
    private mqttService: MqttService,
    private userService: UserService,
    private groupService: GroupService,
    private chatService: ChatService,
    private invitationService: InvitationService,
    private connectionManager: ConnectionManagerService,
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
    this.connectionManager.connected$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.isConnecting = false
    })

    this.invitationService.invitations$.pipe(takeUntil(this.destroy$)).subscribe((invitations) => {
      this.notifications = invitations.filter((invitation) => {
        const group = this.groupService.getGroups().find((g: Group) => g.id === invitation.groupId)
        const isLeader = group && group.leader.id === this.appState.user?.id
        return isLeader
      })
    })
  }

  async connect() {
    if (!this._username.trim() || this.isConnecting) return

    this.isConnecting = true

    try {
      const currentUser = new User(this._username, this._username, true, new Date())
      this.appState.setUser(currentUser)

      const clientId = this.connectionManager.generateClientId(this.appState.user!.id)
      await this.mqttService.connect(clientId)

      await new Promise((resolve) => setTimeout(resolve, 500))

      this.connectionManager.setConnected(true, clientId)

      this.userService.initialize(clientId, currentUser)
      this.groupService.setCurrentUser(currentUser)
      this.groupService.initialize()
      this.chatService.initialize(this.appState.user!.id)
      this.invitationService.initialize(this.appState.user!)

      this.appState.setConnected(true)

      this.usernameChange.emit(this.appState.user!.id)
      this.connectionChange.emit(true)

      this.userService.publishOnlineStatus(currentUser)
      this.userService.requestSync(currentUser)

      this.connectionManager.startHeartbeat(() => {
        this.sendHeartbeat()
      })
    } catch (error) {
      console.error('Erro ao conectar MQTT:', error)
      this.isConnecting = false
      this.connectionManager.setConnected(false, '')
      this.appState.setConnected(false)
    }
  }

  disconnect() {
    const currentUser = this.appState.user
    if (this.appState.connected && currentUser) {
      this.userService.publishOfflineStatus(currentUser)
    }

    this.invitationService.onDisconnect()

    this.connectionManager.stopHeartbeat()
    this.mqttService.disconnect()
    this.appState.setConnected(false)
    this.connectionManager.setConnected(false, '')
    this.connectionChange.emit(false)
  }

  clearAllData() {
    if (confirm('Tem certeza que deseja limpar todos os dados? Esta ação não pode ser desfeita.')) {
      if (this.appState.connected) {
        this.disconnect()
      }

      const keysToRemove = [
        'mqtt-chat-messages',
        'mqtt-chat-pending-messages',
        'mqtt-chat-users',
        'mqtt-chat-groups',
        'mqtt-chat-invitations',
        'mqtt-chat-conversation-requests',
        'mqtt-chat-conversation-sessions',
        'mqtt-chat-debug-history',
        'mqtt-chat-selected-chat'
      ]

      keysToRemove.forEach((key) => {
        localStorage.removeItem(key)
      })

      this.chatService.clearMessages()

      alert('Todos os dados foram limpos! A página será recarregada.')
      window.location.reload()
    }
  }

  private sendHeartbeat() {
    if (this.appState.connected && this.appState.user) {
      const heartbeatMessage = {
        type: 'heartbeat',
        user: this.appState.user,
        clientId: this.connectionManager.clientId,
        timestamp: Date.now()
      }
      this.mqttService.publish('meu-chat-mqtt/heartbeat', JSON.stringify(heartbeatMessage))
    }
  }

  acceptInvite(invitation: GroupInvitation) {
    this.invitationService.acceptInvitation(invitation)
  }

  rejectInvite(invitation: GroupInvitation) {
    this.invitationService.rejectInvitation(invitation)
  }

  onToggleNotifications() {
    this.showNotifications = !this.showNotifications
  }

  get username(): string {
    return this._username
  }

  set username(value: string) {
    this._username = value
  }
}
