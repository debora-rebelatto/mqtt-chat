import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { Subject, takeUntil } from 'rxjs'
import { MqttService } from '../../services/mqtt.service'
import { UserService } from '../../services/user.service'
import { InvitationService } from '../../services/invitation.service'
import { ConnectionManagerService } from '../../services/connection-manager.service'
import { GroupInvitation } from '../../models/group-invitation.model'
import { NotificationsPanelComponent } from '../notifications-panel/notifications-panel.component'

@Component({
  selector: 'app-page-header',
  templateUrl: './page-header.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, NotificationsPanelComponent]
})
export class PageHeaderComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>()

  connected = false
  username = ''
  showNotifications = false
  notifications: GroupInvitation[] = []
  isConnecting = false

  @Output() usernameChange = new EventEmitter<string>()
  @Output() connectionChange = new EventEmitter<boolean>()

  constructor(
    private mqttService: MqttService,
    private userService: UserService,
    private invitationService: InvitationService,
    private connectionManager: ConnectionManagerService
  ) {}

  ngOnInit() {
    this.setupSubscriptions()
  }

  ngOnDestroy() {
    this.destroy$.next()
    this.destroy$.complete()
  }

  private setupSubscriptions() {
    this.connectionManager.connected$.pipe(takeUntil(this.destroy$)).subscribe((connected) => {
      this.connected = connected
      this.isConnecting = false
    })

    this.invitationService.invitations$.pipe(takeUntil(this.destroy$)).subscribe((invitations) => {
      this.notifications = invitations
    })
  }

  async connect() {
    if (!this.username.trim() || this.isConnecting) return

    this.isConnecting = true

    try {
      const clientId = this.connectionManager.generateClientId(this.username)
      await this.mqttService.connect('broker.hivemq.com', 8000, clientId)

      this.connectionManager.setConnected(true, clientId)
      this.userService.initialize(clientId, this.username)
      this.invitationService.initialize(this.username)
      
      // Emit username and connection status
      this.usernameChange.emit(this.username)
      this.connectionChange.emit(true)

      this.userService.publishOnlineStatus(this.username)
      this.userService.requestSync(this.username)

      this.connectionManager.startHeartbeat(() => {
        this.sendHeartbeat()
      })
    } catch {
      this.isConnecting = false
      this.connectionManager.setConnected(false, '')
    }
  }

  disconnect() {
    if (this.connected) {
      this.userService.publishOfflineStatus(this.username)
    }

    this.connectionManager.stopHeartbeat()
    this.mqttService.disconnect()
    this.connectionManager.reset()
    this.invitationService.clearInvitations()
    this.isConnecting = false
    
    // Emit connection status
    this.connectionChange.emit(false)
  }

  private sendHeartbeat() {
    if (this.connected) {
      const heartbeatMessage = {
        type: 'heartbeat',
        username: this.username,
        clientId: this.connectionManager.clientId,
        timestamp: Date.now()
      }
      this.mqttService.publish('meu-chat-mqtt/heartbeat', JSON.stringify(heartbeatMessage))
    }
  }

  acceptInvite(invitation: GroupInvitation) {
    this.invitationService.acceptInvitation(invitation, this.username)
  }

  rejectInvite(invitation: GroupInvitation) {
    this.invitationService.rejectInvitation(invitation, this.username)
  }

  onToggleNotifications() {
    this.showNotifications = !this.showNotifications
  }
}
