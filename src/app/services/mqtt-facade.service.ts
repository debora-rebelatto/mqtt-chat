import { Injectable } from '@angular/core'
import { ChatSessionService } from './chat-session.service'
import { ChatSession } from '../models/chat-session.model'
import { User } from '../models/user.model'
import { MqttConnectionService } from './connection.service'
import { MqttUserService } from './user.service'
import { Client, Message, ConnectionOptions } from 'paho-mqtt'


@Injectable({ providedIn: 'root' })
export class MqttFacadeService {
  private readonly USERS_TOPIC = 'USERS'
  private readonly GROUPS_TOPIC = 'GROUPS'
  private controlTopic = ''
  private currentUserId = ''

  constructor(
    private mqtt: MqttConnectionService,
    private userService: MqttUserService,
    private sessionService: ChatSessionService
  ) {}

  async connect(userId: string) {
    this.currentUserId = userId
    this.controlTopic = `${userId}_Control`

    this.mqtt.initializeClient(
      'broker.hivemq.com',
      8000,
      'user_' + Math.random().toString(16).slice(2)
    )

    this.mqtt.onMessageArrived = this.handleMessage.bind(this)

    await this.mqtt.connect({ useSSL: false })

    this.mqtt.subscribe(this.USERS_TOPIC)
    this.mqtt.subscribe(this.GROUPS_TOPIC)
    this.mqtt.subscribe(this.controlTopic)

    this.publishUserStatus('online')
  }

  disconnect() {
    this.publishUserStatus('offline')
    this.mqtt.disconnect()
  }

  private publishUserStatus(status: 'online' | 'offline') {
    const user: User = {
      id: this.currentUserId,
      status,
      lastSeen: new Date()
    }

    this.userService.addOrUpdateUser(user)
    this.mqtt.publish(this.USERS_TOPIC, user)
  }

  private handleMessage(message: Message) {
    const topic = message.destinationName
    const payload = JSON.parse(message.payloadString)

    if (topic === this.USERS_TOPIC) {
      this.userService.addOrUpdateUser({
        id: payload.userId,
        status: payload.status,
        lastSeen: new Date(payload.timestamp)
      })
    } else if (topic === this.controlTopic) {
      this.handleControlMessage(payload)
    } else if (topic.includes('_')) {
      this.handleChatMessage(topic, payload)
    }
  }

  private handleControlMessage(payload: any) {
    if (payload.type === 'chat_request') {

      console.log('Nova solicitação de chat:', payload)
    } else if (payload.type === 'chat_accepted') {
      const session: ChatSession = {
        sessionId: payload.sessionId,
        participant1: this.currentUserId,
        participant2: payload.from,
        topic: payload.topic,
        timestamp: new Date()
      }

      this.sessionService.addSession(session)
      this.mqtt.subscribe(session.topic)
    }
  }

  private handleChatMessage(topic: string, payload: any) {
    console.log('Mensagem no chat', topic, payload)
  }

  requestChat(toUserId: string) {
    const sessionId = `${this.currentUserId}_${toUserId}_${Date.now()}`
    const topic = `${toUserId}_Control`

    const message = {
      type: 'chat_request',
      from: this.currentUserId,
      to: toUserId,
      proposedSessionId: sessionId,
      timestamp: new Date().toISOString()
    }

    this.mqtt.publish(topic, message)
  }

  acceptChatRequest(request: any) {
    const topic = request.proposedSessionId

    const message = {
      type: 'chat_accepted',
      from: this.currentUserId,
      to: request.from,
      sessionId: request.proposedSessionId,
      topic,
      timestamp: new Date().toISOString()
    }

    this.sessionService.addSession({
      sessionId: request.proposedSessionId,
      participant1: this.currentUserId,
      participant2: request.from,
      topic,
      timestamp: new Date()
    })

    this.mqtt.publish(`${request.from}_Control`, message)
    this.mqtt.subscribe(topic)
  }

  getUsers(): User[] {
    return this.userService.getUsers()
  }

  getSessions(): ChatSession[] {
    return this.sessionService.getSessions()
  }
}
