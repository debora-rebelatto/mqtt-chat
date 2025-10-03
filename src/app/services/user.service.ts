import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { MqttService } from './mqtt.service'
import { UserStatus } from '../models/user-status.model'

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private usersSubject = new BehaviorSubject<UserStatus[]>([])
  public users$ = this.usersSubject.asObservable()

  private lastSeenMap: Map<string, number> = new Map()
  private clientId: string = ''
  private readonly STORAGE_KEY = 'mqtt-chat-users'
  constructor(private mqttService: MqttService) {
    this.loadUsersFromStorage()
    this.startHeartbeatMonitor()
  }

  initialize(clientId: string, username: string) {
    this.clientId = clientId
    this.setupSubscriptions(username)
    this.publishOnlineStatus(username)
  }
  private setupSubscriptions(username: string) {
    this.mqttService.subscribe('meu-chat-mqtt/status', (message) => {
      this.handleStatusMessage(message)
    })

    this.mqttService.subscribe('meu-chat-mqtt/status/disconnected', (message) => {
      this.handleDisconnectMessage(message)
    })

    this.mqttService.subscribe('meu-chat-mqtt/heartbeat', (message) => {
      this.handleHeartbeatMessage(message)
    })

    this.mqttService.subscribe('meu-chat-mqtt/sync', (message) => {
      this.handleSyncMessage(message, username)
    })
  }

  publishOnlineStatus(username: string) {
    const now = Date.now()
    this.lastSeenMap.set(username, now)

    const statusMessage = {
      type: 'online',
      username: username,
      clientId: this.clientId,
      timestamp: new Date(now)
    }

    this.mqttService.publish('meu-chat-mqtt/status', JSON.stringify(statusMessage))
  }

  publishOfflineStatus(username: string) {
    const offlineMessage = {
      type: 'offline',
      username: username,
      clientId: this.clientId,
      timestamp: new Date()
    }

    this.mqttService.publish('meu-chat-mqtt/status', JSON.stringify(offlineMessage))
    this.lastSeenMap.delete(username)
  }

  requestSync(username: string) {
    const syncMessage = {
      type: 'sync_request',
      from: username,
      clientId: this.clientId,
      timestamp: new Date()
    }

    this.mqttService.publish('meu-chat-mqtt/sync', JSON.stringify(syncMessage))
  }

  private handleStatusMessage(message: string) {
    const status = JSON.parse(message)

    if (status.type === 'online') {
      this.lastSeenMap.set(status.username, Date.now())
      this.addOrUpdateUser({
        username: status.username,
        online: true,
        lastSeen: new Date(status.timestamp),
        clientId: status.clientId
      })
      
      this.mqttService.publish(`meu-chat-mqtt/sync/pending/${status.username}`, JSON.stringify({
        type: 'request_pending',
        username: status.username,
        timestamp: new Date()
      }))
    } else if (status.type === 'offline') {
      this.lastSeenMap.delete(status.username)
      this.addOrUpdateUser({
        username: status.username,
        online: false,
        lastSeen: new Date(status.timestamp),
        clientId: status.clientId
      })
    }
  }

  private handleDisconnectMessage(message: string) {
    const disconnect = JSON.parse(message)

    this.addOrUpdateUser({
      username: disconnect.username,
      online: false,
      lastSeen: new Date(disconnect.timestamp),
      clientId: disconnect.clientId
    })
  }

  private handleHeartbeatMessage(message: string) {
    const heartbeat = JSON.parse(message)

    if (heartbeat.type === 'heartbeat') {
      this.lastSeenMap.set(heartbeat.username, heartbeat.timestamp)

      this.addOrUpdateUser({
        username: heartbeat.username,
        online: true,
        lastSeen: new Date(heartbeat.timestamp),
        clientId: heartbeat.clientId
      })
    }
  }

  private handleSyncMessage(message: string, currentUsername: string) {
    const sync = JSON.parse(message)
    if (sync.type === 'sync_request' && sync.from !== currentUsername) {
      this.publishOnlineStatus(currentUsername)
    }
  }

  private addOrUpdateUser(userStatus: UserStatus) {
    const currentUsers = this.usersSubject.value
    const existingIndex = currentUsers.findIndex((user) => user.username === userStatus.username)

    let updatedUsers: UserStatus[]
    if (existingIndex >= 0) {
      updatedUsers = [...currentUsers]
      updatedUsers[existingIndex] = userStatus
    } else {
      updatedUsers = [...currentUsers, userStatus]
    }

    const now = new Date().getTime()
    updatedUsers = updatedUsers.filter(
      (user) => user.online || now - user.lastSeen.getTime() < 7 * 24 * 60 * 60 * 1000
    )

    updatedUsers.sort((a, b) => {
      if (a.online && !b.online) return -1
      if (!a.online && b.online) return 1
      return a.username.localeCompare(b.username)
    })

    this.usersSubject.next(updatedUsers)
    this.saveUsersToStorage(updatedUsers)
  }

  getOnlineUsersCount(): number {
    return this.usersSubject.value.filter((u) => u.online).length
  }

  private loadUsersFromStorage() {
    const stored = localStorage.getItem(this.STORAGE_KEY)
    if (stored) {
      const users = JSON.parse(stored).map((user: UserStatus & { lastSeen: string }) => ({
        ...user,
        lastSeen: new Date(user.lastSeen)
      }))
      this.usersSubject.next(users)
    }
  }

  private saveUsersToStorage(users: UserStatus[]) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(users))
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

    const updatedUsers = currentUsers.map(user => {
      if (user.online) {
        const lastHeartbeat = this.lastSeenMap.get(user.username)
        const timeSinceHeartbeat = lastHeartbeat ? now - lastHeartbeat : 999999
        
        if (!lastHeartbeat || timeSinceHeartbeat > 60000) {
          console.log(`User ${user.username} going offline - last heartbeat: ${timeSinceHeartbeat}ms ago`)
          hasChanges = true
          return {
            ...user,
            online: false,
            lastSeen: new Date(lastHeartbeat || now)
          }
        }
      }
      return user
    })

    if (hasChanges) {
      this.usersSubject.next(updatedUsers)
      this.saveUsersToStorage(updatedUsers)
    }
  }
}
