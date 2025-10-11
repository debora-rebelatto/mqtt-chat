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

  private lastSeenMap: Map<string, number> = new Map()
  private currentUser: User | null = null
  private readonly STORAGE_KEY = 'mqtt-chat-users'

  constructor(
    private mqttService: MqttService,
    private appState: AppStateService
  ) {
    this.loadUsersFromStorage()
    this.startHeartbeatMonitor()
  }

  initialize() {
    this.currentUser = this.appState.user
    this.setupSubscriptions(this.currentUser!)
    this.publishOnlineStatus(this.currentUser!)
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

  publishOnlineStatus(user: User) {
    const now = Date.now()
    this.lastSeenMap.set(user.id, now)

    const statusMessage = {
      type: 'online',
      user: user,
      clientId: user.id,
      timestamp: new Date(now)
    }

    this.mqttService.publish(MqttTopics.status, JSON.stringify(statusMessage))
  }

  publishOfflineStatus(user: User) {
    const offlineMessage = {
      type: 'offline',
      user: user,
      clientId: user.id,
      timestamp: new Date()
    }

    this.mqttService.publish(MqttTopics.status, JSON.stringify(offlineMessage))
    this.lastSeenMap.delete(user.id)
  }

  requestSync(user: User) {
    const syncMessage = {
      type: 'sync_request',
      from: user,
      clientId: user.id,
      timestamp: new Date()
    }

    this.mqttService.publish(MqttTopics.sync, JSON.stringify(syncMessage))
  }

  private handleStatusMessage(message: string) {
    const status = JSON.parse(message)

    if (status.type === 'online') {
      this.lastSeenMap.set(status.user.id, Date.now())
      this.addOrUpdateUser(
        new User(status.user.id, status.user.name, true, new Date(status.timestamp))
      )

      this.mqttService.publish(
        MqttTopics.pendingSync(status.user.id),
        JSON.stringify({
          type: 'request_pending',
          user: status.user,
          timestamp: new Date()
        })
      )
    } else if (status.type === 'offline') {
      this.lastSeenMap.delete(status.user.id)
      this.addOrUpdateUser(
        new User(status.user.id, status.user.name, false, new Date(status.timestamp))
      )
    }
  }

  private handleDisconnectMessage(message: string) {
    const disconnect = JSON.parse(message)

    this.addOrUpdateUser(
      new User(disconnect.user.id, disconnect.user.name, false, new Date(disconnect.timestamp))
    )
  }

  private handleHeartbeatMessage(message: string) {
    const heartbeat = JSON.parse(message)

    if (heartbeat.type === 'heartbeat') {
      this.lastSeenMap.set(heartbeat.user.id, heartbeat.timestamp)

      this.addOrUpdateUser(
        new User(heartbeat.user.id, heartbeat.user.name, true, new Date(heartbeat.timestamp))
      )
    }
  }

  private handleSyncMessage(message: string, currentUser: User) {
    const sync = JSON.parse(message)
    if (sync.type === 'sync_request' && sync.from.id !== currentUser.id) {
      this.publishOnlineStatus(currentUser)
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
    updatedUsers = updatedUsers.filter(
      (user) => user.online || now - user.lastSeen!.getTime() < 7 * 24 * 60 * 60 * 1000
    )

    updatedUsers.sort((a, b) => {
      if (a.online && !b.online) return -1
      if (!a.online && b.online) return 1

      const nameA = a.name || ''
      const nameB = b.name || ''
      return nameA.localeCompare(nameB)
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
      const usersData = JSON.parse(stored)
      const users = usersData.map(
        (userData: User) =>
          new User(userData.id, userData.name, userData.online, new Date(userData.lastSeen!))
      )
      this.usersSubject.next(users)
    }
  }

  private saveUsersToStorage(users: User[]) {
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

    const updatedUsers = currentUsers.map((user) => {
      if (user.online) {
        const lastHeartbeat = this.lastSeenMap.get(user.id)
        const timeSinceHeartbeat = lastHeartbeat ? now - lastHeartbeat : 999999

        if (!lastHeartbeat || timeSinceHeartbeat > 60000) {
          hasChanges = true
          return new User(user.id, user.name, false, new Date(lastHeartbeat || now))
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
