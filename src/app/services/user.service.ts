import { PendingMessagesService } from './pending-messages.service'
import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { MqttService } from './mqtt.service'
import { User } from '../models'
import { MqttTopics } from '../config/mqtt-topics'
import { AppStateService } from './app-state.service'
import { ConnectionManagerService } from './connection-manager.service'

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private usersSubject = new BehaviorSubject<User[]>([])
  public users$ = this.usersSubject.asObservable()
  private currentUser: User | null = null
  private readonly OFFLINE_RETENTION_PERIOD = 7 * 24 * 60 * 60 * 1000
  private readonly HEARTBEAT_TIMEOUT = 30000
  private readonly HEARTBEAT_INTERVAL = 5000
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    private mqttService: MqttService,
    private appState: AppStateService,
    private connectionManager: ConnectionManagerService,
    private pendingMessagesService: PendingMessagesService
  ) {
    this.startHeartbeatMonitor()
  }

  initialize() {
    if (this.appState.user) {
      this.currentUser = this.appState.user
      this.setupSubscriptions(this.currentUser)

      const localUser = new User(this.currentUser.id, this.currentUser.name, true, new Date())
      this.addOrUpdateUser(localUser)

      this.updateUserStatus(MqttTopics.status, 'online', this.currentUser)
      this.sendHeartbeat()

      this.startSendingHeartbeats()
    }
  }

  private setupSubscriptions(user: User) {
    this.mqttService.subscribe(MqttTopics.status, (message) => {
      this.handleStatusMessage(message)
    })

    this.mqttService.subscribe(MqttTopics.disconnected, (message) => {
      this.handleDisconnectMessage(message)
    })

    this.mqttService.subscribe(MqttTopics.heartbeat, (message) => {
      this.handleHeartbeatMessage(message)
    })

    this.mqttService.subscribe(MqttTopics.sync, (message) => {
      this.handleSyncMessage(message, user)
    })
  }

  updateUserStatus(topic: string, type: string, user?: User, timestamp?: Date): void {
    user = user ?? this.appState.user!

    const message = {
      type: type,
      user: user,
      clientId: user.id,
      timestamp: timestamp ?? new Date()
    }

    this.mqttService.publish(topic, JSON.stringify(message), true)
  }

  private startSendingHeartbeats() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat()
    }, this.HEARTBEAT_INTERVAL)
  }

  private sendHeartbeat() {
    if (this.currentUser && this.connectionManager.connected) {
      const heartbeatMessage = {
        type: 'heartbeat',
        user: this.currentUser,
        timestamp: new Date().toISOString()
      }

      this.mqttService.publish(MqttTopics.heartbeat, JSON.stringify(heartbeatMessage))

      const updatedUser = new User(this.currentUser.id, this.currentUser.name, true, new Date())
      this.addOrUpdateUser(updatedUser)
    }
  }

  private handleStatusMessage(message: string) {
    const status = JSON.parse(message)

    const isOnline = status.type === 'online'
    const timestamp = status.timestamp ? new Date(status.timestamp) : new Date()
    const user = new User(status.user.id, status.user.name, isOnline, timestamp)

    this.addOrUpdateUser(user)

    if (isOnline && status.user.id !== this.currentUser?.id) {
      this.updateUserStatus(MqttTopics.pendingSync(status.user.id), 'request_pending', status.user)
      this.pendingMessagesService.sendPendingMessagesToUser(status.user.id)
    }
  }

  private handleDisconnectMessage(message: string) {
    const disconnect = JSON.parse(message)
    const timestamp = Date.now()

    this.addOrUpdateUser(
      new User(disconnect.user.id, disconnect.user.name, false, new Date(timestamp))
    )
  }

  private handleHeartbeatMessage(message: string) {
    const heartbeat = JSON.parse(message)

    if (heartbeat.type === 'heartbeat') {
      const timestamp = heartbeat.timestamp ? new Date(heartbeat.timestamp) : new Date()
      this.addOrUpdateUser(new User(heartbeat.user.id, heartbeat.user.name, true, timestamp))
    }
  }

  private handleSyncMessage(message: string, currentUser: User) {
    const sync = JSON.parse(message)
    if (sync.type === 'sync_request' && sync.from.id !== currentUser.id) {
      this.updateUserStatus(MqttTopics.status, 'online', currentUser)
    }
  }

  private addOrUpdateUser(userStatus: User) {
    const currentUsers = this.usersSubject.value
    const existingIndex = currentUsers.findIndex((user) => user.id === userStatus.id)

    let updatedUsers: User[]
    if (existingIndex >= 0) {
      updatedUsers = [...currentUsers]
      updatedUsers[existingIndex] = userStatus
    } else {
      updatedUsers = [...currentUsers, userStatus]
    }

    const now = new Date().getTime()
    updatedUsers = updatedUsers.filter((user) => {
      if (user.online) {
        return true
      }

      if (user.lastSeen) {
        const timeSinceLastSeen = now - user.lastSeen.getTime()
        const shouldKeep = timeSinceLastSeen < this.OFFLINE_RETENTION_PERIOD
        return shouldKeep
      }

      return false
    })

    updatedUsers.sort((a, b) => {
      if (a.online && !b.online) return -1
      if (!a.online && b.online) return 1

      const nameA = a.name || ''
      const nameB = b.name || ''
      return nameA.localeCompare(nameB)
    })

    this.usersSubject.next(updatedUsers)
  }

  private startHeartbeatMonitor() {
    setInterval(() => {
      this.checkOfflineUsers()
    }, 15000)
  }

  private checkOfflineUsers() {
    const now = Date.now()
    const currentUsers = this.usersSubject.value
    let hasChanges = false

    const updatedUsers = currentUsers.map((user) => {
      if (user.id === this.currentUser?.id) {
        return user
      }

      if (user.online && user.lastSeen) {
        const timeSinceHeartbeat = now - user.lastSeen.getTime()

        if (timeSinceHeartbeat > this.HEARTBEAT_TIMEOUT) {
          hasChanges = true
          return new User(user.id, user.name, false, user.lastSeen)
        }
      }
      return user
    })

    if (hasChanges) {
      this.usersSubject.next(updatedUsers)
    }
  }

  ngOnDestroy() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }

    if (this.currentUser) {
      this.updateUserStatus(MqttTopics.disconnected, 'offline', this.currentUser)
    }
  }
}
