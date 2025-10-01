import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { UserStatus } from '../models/user-status.model'
import { MqttService } from './mqtt.service'

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private usersSubject = new BehaviorSubject<UserStatus[]>([])
  public users$ = this.usersSubject.asObservable()

  private lastSeenMap: Map<string, number> = new Map()
  private clientId: string = ''

  constructor(private mqttService: MqttService) {}

  initialize(clientId: string, username: string) {
    this.clientId = clientId
    this.setupSubscriptions(username)
  }

  private setupSubscriptions(username: string) {
    this.mqttService.subscribe('meu-chat-mqtt/status', (message) => {
      this.handleStatusMessage(message, username)
    })

    this.mqttService.subscribe('meu-chat-mqtt/status/disconnected', (message) => {
      this.handleDisconnectMessage(message, username)
    })

    this.mqttService.subscribe('meu-chat-mqtt/heartbeat', (message) => {
      this.handleHeartbeatMessage(message)
    })

    this.mqttService.subscribe('meu-chat-mqtt/sync', (message) => {
      this.handleSyncMessage(message, username)
    })
  }

  publishOnlineStatus(username: string) {
    this.lastSeenMap.set(username, Date.now())

    const statusMessage = {
      type: 'online',
      username: username,
      clientId: this.clientId,
      timestamp: new Date()
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

  private handleStatusMessage(message: string, currentUsername: string) {
    try {
      const status = JSON.parse(message)

      if (status.type === 'online') {
        this.addOrUpdateUser({
          username: status.username,
          online: true,
          lastSeen: new Date(status.timestamp),
          clientId: status.clientId
        })
      } else if (status.type === 'offline') {
        this.addOrUpdateUser({
          username: status.username,
          online: false,
          lastSeen: new Date(status.timestamp),
          clientId: status.clientId
        })
      }
    } catch (e) {
      console.error('Erro ao processar status:', e)
    }
  }

  private handleDisconnectMessage(message: string, currentUsername: string) {
    try {
      const disconnect = JSON.parse(message)

      this.addOrUpdateUser({
        username: disconnect.username,
        online: false,
        lastSeen: new Date(disconnect.timestamp),
        clientId: disconnect.clientId
      })
    } catch (e) {
      console.error('Erro ao processar desconexão:', e)
    }
  }

  private handleHeartbeatMessage(message: string) {
    try {
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
    } catch (e) {
      console.error('Erro ao processar heartbeat:', e)
    }
  }

  private handleSyncMessage(message: string, currentUsername: string) {
    try {
      const sync = JSON.parse(message) // CORREÇÃO: mudado de syncData para message
      if (sync.type === 'sync_request' && sync.from !== currentUsername) {
        this.publishOnlineStatus(currentUsername)
      }
    } catch (e) {
      console.error('Erro ao processar sync:', e)
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

    // Limpa usuários offline antigos
    const now = new Date().getTime()
    updatedUsers = updatedUsers.filter(
      (user) => user.online || now - user.lastSeen.getTime() < 120000
    )

    // Ordena
    updatedUsers.sort((a, b) => {
      if (a.online && !b.online) return -1
      if (!a.online && b.online) return 1
      return a.username.localeCompare(b.username)
    })

    this.usersSubject.next(updatedUsers)
  }

  getOnlineUsersCount(): number {
    return this.usersSubject.value.filter((u) => u.online).length
  }
}
