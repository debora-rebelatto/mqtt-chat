import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { TranslateModule } from '@ngx-translate/core'
import { Subject, takeUntil } from 'rxjs'
import { LucideAngularModule, MessageCircle } from 'lucide-angular'
import { GroupInvitation } from '../../models/group-invitation.model'
import { Group } from '../../models/group.model'
import {
  NotificationItem,
  NotificationsPanelComponent
} from '../notifications-panel/notifications-panel.component'
import {
  MqttService,
  UserService,
  GroupService,
  ChatService,
  InvitationService,
  ConnectionManagerService,
  AppStateService,
  IdGeneratorService,
  PrivateChatRequestService
} from '../../services'
import { PrivateChatRequest, User } from '../../models'
import { MqttTopics } from '../../config/mqtt-topics'

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
  private _username = ''
  groupNotifications: GroupInvitation[] = []
  chatNotifications: PrivateChatRequest[] = []
  showNotificationPanel = false

  @Output() usernameChange = new EventEmitter<string>()
  @Output() connectionChange = new EventEmitter<boolean>()

  constructor(
    private mqttService: MqttService,
    private userService: UserService,
    private groupService: GroupService,
    private chatService: ChatService,
    private connectionManager: ConnectionManagerService,
    public appState: AppStateService,
    public idGeneratorService: IdGeneratorService,
    private invitationService: InvitationService,
    public privateChatRequestService: PrivateChatRequestService
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
      this.groupNotifications = invitations.filter((invitation) => {
        const group = this.groupService.getGroups().find((g: Group) => g.id === invitation.groupId)
        const isLeader = group && group.leader.id === this.appState.user?.id
        return isLeader
      })
    })

    this.privateChatRequestService.requests$
      .pipe(takeUntil(this.destroy$))
      .subscribe((requests) => {
        this.chatNotifications = requests.filter((req) => req.status === 'pending')
      })
  }

  async connect() {
    if (!this._username.trim() || this.isConnecting) return

    this.isConnecting = true

    try {
      const currentUser = new User(this._username, this._username, true, new Date())
      this.appState.setUser(currentUser)

      const clientId = this.idGeneratorService.generateClientId(this.appState.user!.id)
      await this.mqttService.connect(clientId)

      await new Promise((resolve) => setTimeout(resolve, 500))

      this.connectionManager.setConnected(true, clientId)

      this.userService.initialize()
      this.groupService.initialize()
      this.chatService.initialize()
      this.invitationService.initialize()
      this.privateChatRequestService.initialize()

      this.appState.setConnected(true)

      this.usernameChange.emit(this.appState.user!.id)
      this.connectionChange.emit(true)

      this.userService.updateUserStatus(MqttTopics.status, 'online')
      this.userService.updateUserStatus(MqttTopics.status, 'sync_request')

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
      this.userService.updateUserStatus(MqttTopics.status, 'offline', currentUser)
    }

    this.invitationService.onDisconnect()
    this.privateChatRequestService.onDisconnect()
    this.connectionManager.stopHeartbeat()
    this.mqttService.disconnect()
    this.appState.setConnected(false)
    this.connectionManager.setConnected(false, '')
    this.connectionChange.emit(false)
  }

  private sendHeartbeat() {
    if (this.appState.connected && this.appState.user) {
      const heartbeatMessage = {
        type: 'heartbeat',
        user: this.appState.user,
        clientId: this.connectionManager.clientId,
        timestamp: Date.now()
      }
      this.mqttService.publish(MqttTopics.heartbeat, JSON.stringify(heartbeatMessage))
    }
  }

  onToggleNotifications() {
    this.showNotificationPanel = !this.showNotificationPanel
  }

  get username(): string {
    return this._username
  }

  set username(value: string) {
    this._username = value
  }

  get allNotifications(): NotificationItem[] {
    const groupItems: NotificationItem[] = this.groupNotifications.map((notification) => ({
      type: 'group-invitation',
      data: notification
    }))

    const chatItems: NotificationItem[] = this.chatNotifications.map((notification) => ({
      type: 'private-chat-request',
      data: notification
    }))

    return [...groupItems, ...chatItems]
  }
}
