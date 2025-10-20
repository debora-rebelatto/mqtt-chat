import { Component, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { TranslateModule } from '@ngx-translate/core'
import { LucideAngularModule, MessageCircle } from 'lucide-angular'
import { NotificationsPanelComponent } from '../notifications-panel/notifications-panel.component'
import {
  MqttService,
  UserService,
  InvitationService,
  ConnectionManagerService,
  AppStateService,
  IdGeneratorService
} from '../../services'
import { MqttTopics } from '../../config/mqtt-topics'
import { LoginComponent } from '../login/login.component'

@Component({
  selector: 'app-page-header',
  templateUrl: './page-header.component.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NotificationsPanelComponent,
    LucideAngularModule,
    TranslateModule,
    LoginComponent
  ]
})
export class PageHeaderComponent {
  readonly MessageCircle = MessageCircle
  @Output() connectionChange = new EventEmitter<boolean>()

  constructor(
    private mqttService: MqttService,
    private userService: UserService,
    private connectionManager: ConnectionManagerService,
    public appState: AppStateService,
    public idGeneratorService: IdGeneratorService,
    private invitationService: InvitationService,
  ) {}

  disconnect() {
    const currentUser = this.appState.user
    if (this.appState.connected && currentUser) {
      this.userService.updateUserStatus(MqttTopics.status, 'offline', currentUser)
    }

    this.invitationService.onDisconnect()
    this.connectionManager.stopHeartbeat()
    this.mqttService.disconnect()
    this.appState.setConnected(false)
    this.connectionManager.setConnected(false, '')
    this.connectionChange.emit(false)
  }
}
