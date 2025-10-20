import { CommonModule } from '@angular/common'
import { Output, EventEmitter, Component } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { TranslateModule } from '@ngx-translate/core'
import { Subject, takeUntil } from 'rxjs'
import { MqttTopics } from '../../config/mqtt-topics'
import {
  MqttService,
  AuthService,
  UserService,
  GroupService,
  ChatService,
  ConnectionManagerService,
  AppStateService,
  IdGeneratorService,
  InvitationService,
  PrivateChatRequestService
} from '../../services'
import { User } from '../../models'

@Component({
  selector: 'login',
  templateUrl: './login.component.html',
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule]
})
export class LoginComponent {
  isConnecting = false
  isSignupMode = false
  errorMessage = ''
  successMessage = ''
  private _username = ''
  private _password = ''
  private destroy$ = new Subject<void>()

  @Output() usernameChange = new EventEmitter<string>()
  @Output() connectionChange = new EventEmitter<boolean>()

  constructor(
    private mqttService: MqttService,
    private authService: AuthService,
    private userService: UserService,
    private groupService: GroupService,
    private chatService: ChatService,
    private connectionManager: ConnectionManagerService,
    public appState: AppStateService,
    public idGeneratorService: IdGeneratorService,
    private invitationService: InvitationService,
    public privateChatRequestService: PrivateChatRequestService
  ) {}

  async ngOnInit() {
    this.setupSubscriptions()
    await this.connectForAuth()
  }

  private async connectForAuth() {
    const authClientId = this.idGeneratorService.generateId('auth_temp')
    await this.mqttService.connect(authClientId)
    this.authService.initialize()
  }

  ngOnDestroy() {
    this.destroy$.next()
    this.destroy$.complete()
    this.authService.clearAuthTimeout()
  }

  private setupSubscriptions() {
    this.connectionManager.connected$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.isConnecting = false
    })
  }

  toggleSignupMode() {
    this.isSignupMode = !this.isSignupMode
    this.errorMessage = ''
    this.successMessage = ''
    this._password = ''
  }

  canSignup(): boolean {
    return this._username.trim() !== '' && this._password.trim() !== ''
  }

  async signup() {
    if (!this.canSignup() || this.isConnecting) return

    this.isConnecting = true
    this.errorMessage = ''
    this.successMessage = ''

    try {
      const tempClientId = this.idGeneratorService.generateId(`signup_${this._username}`)
      await this.mqttService.connect(tempClientId)

      await new Promise((resolve) => setTimeout(resolve, 300))

      const signupResponse = await this.authService.signup(this._username, this._password)

      this.mqttService.disconnect()

      if (!signupResponse.success) {
        throw new Error(signupResponse.message || 'Falha ao criar conta')
      }

      this.successMessage = 'Conta criada com sucesso! Faça login.'
      this.isSignupMode = false
      this._password = ''
      this.isConnecting = false
    } catch (error: any) {
      this.errorMessage = error.message || 'Erro ao criar conta. Tente novamente.'
      this.isConnecting = false

      try {
        this.mqttService.disconnect()
      } catch (e) {
        console.error('Erro ao desconectar MQTT:', e)
      }
    }
  }

  async connect() {
    if (!this._username.trim() || !this._password.trim() || this.isConnecting) return

    this.isConnecting = true
    this.errorMessage = ''
    this.successMessage = ''

    try {
      const clientId = this.idGeneratorService.generateId(`chat_${this._username}`)
      await this.mqttService.connect(clientId)

      await new Promise((resolve) => setTimeout(resolve, 300))

      const authResponse = await this.authService.authenticate(this._username, this._password)

      if (!authResponse.success) {
        throw new Error(authResponse.message || 'Falha na autenticação')
      }

      const currentUser = new User(
        authResponse.userId || this._username,
        this._username,
        true,
        new Date()
      )
      this.appState.setUser(currentUser)

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

      this._password = ''
    } catch (error: any) {
      this.errorMessage = error.message || 'Erro ao conectar. Tente novamente.'
      this.isConnecting = false
      this.connectionManager.setConnected(false, '')
      this.appState.setConnected(false)

      try {
        this.mqttService.disconnect()
      } catch (e) {
        console.error('Erro ao desconectar MQTT:', e)
      }
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
      this.mqttService.publish(MqttTopics.heartbeat, JSON.stringify(heartbeatMessage))
    }
  }

  get username(): string {
    return this._username
  }

  set username(value: string) {
    this._username = value
    this.errorMessage = ''
    this.successMessage = ''
  }

  get password(): string {
    return this._password
  }

  set password(value: string) {
    this._password = value
    this.errorMessage = ''
    this.successMessage = ''
  }
}
