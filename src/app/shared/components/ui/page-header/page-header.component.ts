import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { Subject, takeUntil } from 'rxjs'
import { LucideAngularModule, MessageCircle } from 'lucide-angular'
import { GroupInvitation } from '../../../../models/group-invitation.model'
import { TranslatePipe } from '../../../../pipes/translate.pipe'
import { AppStateService } from '../../../../services/app-state.service'
import { ChatService } from '../../../../services/chat.service'
import { ConnectionManagerService } from '../../../../services/connection-manager.service'
import { GroupService } from '../../../../services/group.service'
import { InvitationService } from '../../../../services/invitation.service'
import { MqttService } from '../../../../services/mqtt.service'
import { UserService } from '../../../../services/user.service'
import { NotificationsPanelComponent } from '../../notifications/notifications-panel/notifications-panel.component'

@Component({
  selector: 'app-page-header',
  templateUrl: './page-header.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, NotificationsPanelComponent, LucideAngularModule, TranslatePipe]
})
export class PageHeaderComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>()
  readonly MessageCircle = MessageCircle

  showNotifications = false
  notifications: GroupInvitation[] = []
  isConnecting = false

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
      this.notifications = invitations
    })
  }

  async connect() {
    if (!this.appState.username.trim() || this.isConnecting) return

    this.isConnecting = true

    try {
      const clientId = this.connectionManager.generateClientId(this.appState.username)
      await this.mqttService.connect('broker.hivemq.com', 8000, clientId)

      this.connectionManager.setConnected(true, clientId)
      this.userService.initialize(clientId, this.appState.username)
      this.groupService.initialize()
      this.chatService.initialize(this.appState.username)
      this.chatService.forceLoad()
      this.invitationService.initialize(this.appState.username)
      
      this.appState.setConnected(true)
      
      this.usernameChange.emit(this.appState.username)
      this.connectionChange.emit(true)

      this.userService.publishOnlineStatus(this.appState.username)
      this.userService.requestSync(this.appState.username)

      this.connectionManager.startHeartbeat(() => {
        this.sendHeartbeat()
      })
    } catch {
      this.isConnecting = false
      this.connectionManager.setConnected(false, '')
    }
  }

  disconnect() {
    if (this.appState.connected) {
      this.userService.publishOfflineStatus(this.appState.username)
    }

    this.connectionManager.stopHeartbeat()
    this.mqttService.disconnect()
    this.appState.setConnected(false)
    this.connectionManager.setConnected(false, '')
    this.connectionChange.emit(false)
  }

  private sendHeartbeat() {
    if (this.appState.connected) {
      const heartbeatMessage = {
        type: 'heartbeat',
        username: this.appState.username,
        clientId: this.connectionManager.clientId,
        timestamp: Date.now()
      }
      this.mqttService.publish('meu-chat-mqtt/heartbeat', JSON.stringify(heartbeatMessage))
    }
  }

  acceptInvite(invitation: GroupInvitation) {
    this.invitationService.acceptInvitation(invitation, this.appState.username)
  }

  rejectInvite(invitation: GroupInvitation) {
    this.invitationService.rejectInvitation(invitation, this.appState.username)
  }

  onToggleNotifications() {
    this.showNotifications = !this.showNotifications
  }

  get username(): string {
    return this.appState.username
  }

  set username(value: string) {
    this.appState.setUsername(value)
  }
}
