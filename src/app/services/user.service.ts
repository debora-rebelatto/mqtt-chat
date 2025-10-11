import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { MqttService } from './mqtt.service'
import { User } from '../models'
import { MqttTopics } from '../config/mqtt-topics'
import { AppStateService } from './app-state.service'

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private usersSubject = new BehaviorSubject<User[]>([])
  public users$ = this.usersSubject.asObservable()
  private currentUser: User | null = null
  private readonly OFFLINE_RETENTION_PERIOD = 7 * 24 * 60 * 60 * 1000
  private readonly HEARTBEAT_TIMEOUT = 200

  constructor(
    private mqttService: MqttService,
    private appState: AppStateService
  ) {
    this.startHeartbeatMonitor()
  }

  initialize() {
    this.currentUser = this.appState.user
    this.setupSubscriptions(this.currentUser!)

    this.updateUserStatus(MqttTopics.status, 'online', this.currentUser!)
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

    this.mqttService.publish(topic, JSON.stringify(message))
  }

  private handleStatusMessage(message: string) {
    const status = JSON.parse(message)

    const isOnline = status.type === 'online'
    const user = new User(status.user.id, status.user.name, isOnline, new Date())

    this.addOrUpdateUser(user)

    if (isOnline) {
      this.updateUserStatus(MqttTopics.pendingSync(status.user.id), 'request_pending', status.user)
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
      this.addOrUpdateUser(
        new User(heartbeat.user.id, heartbeat.user.name, true, new Date(heartbeat.timestamp))
      )
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
}
