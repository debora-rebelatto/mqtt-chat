import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { MqttTopics } from '../config/mqtt-topics'
import { User } from '../models'
import { MqttService, AppStateService, IdGeneratorService } from '.'

export interface PrivateChatRequest {
  id: string
  from: User
  to: string
  timestamp: Date
  status: 'pending' | 'accepted' | 'rejected'
}

@Injectable({
  providedIn: 'root'
})
export class PrivateChatRequestService {
  private requestsSubject = new BehaviorSubject<PrivateChatRequest[]>([])
  private sentRequestsSubject = new BehaviorSubject<PrivateChatRequest[]>([])
  private allowedChatsSubject = new BehaviorSubject<Set<string>>(new Set())

  public requests$ = this.requestsSubject.asObservable()
  public sentRequests$ = this.sentRequestsSubject.asObservable()
  public allowedChats$ = this.allowedChatsSubject.asObservable()

  private currentUser!: User
  private processedRequestIds = new Set<string>()

  constructor(
    private mqttService: MqttService,
    private appState: AppStateService,
    private idGenerator: IdGeneratorService
  ) {}

  initialize() {
    console.log('======initialize')
    this.currentUser = this.appState.user!
    this.mqttService.subscribe(MqttTopics.privateChat.request(this.currentUser.id), (message) => {
      this.handleIncomingRequest(message)
    })

    this.mqttService.subscribe(MqttTopics.privateChat.response(this.currentUser.id), (message) => {
      this.handleRequestResponse(message)
    })

    this.requestAllowedChats()
  }

  sendChatRequest(targetUser: User): boolean {
    if (this.isAllowedToChat(targetUser.id)) {
      return true
    }

    const existingRequest = this.sentRequestsSubject.value.find(
      (req) => req.to === targetUser.id && req.status === 'pending'
    )

    if (existingRequest) {
      return false
    }

    const requestId = this.idGenerator.generateId('chat_req')

    const request: PrivateChatRequest = {
      id: requestId,
      from: this.currentUser,
      to: targetUser.id,
      timestamp: new Date(),
      status: 'pending'
    }

    const payload = {
      id: requestId,
      from: {
        id: this.currentUser.id,
        name: this.currentUser.name
      },
      to: targetUser.id,
      timestamp: request.timestamp.toISOString(),
      type: 'chat_request'
    }

    const sentRequests = [...this.sentRequestsSubject.value, request]
    this.sentRequestsSubject.next(sentRequests)

    this.mqttService.publish(
      MqttTopics.privateChat.request(targetUser.id),
      JSON.stringify(payload),
      false,
      1
    )

    return true
  }

  acceptRequest(request: PrivateChatRequest) {
    this.processedRequestIds.add(request.id)

    const response = {
      requestId: request.id,
      from: this.currentUser.id,
      to: request.from.id,
      accepted: true,
      timestamp: new Date().toISOString(),
      type: 'chat_response'
    }

    this.addAllowedChat(request.from.id)

    this.removeRequest(request.id)

    this.mqttService.publish(
      MqttTopics.privateChat.response(request.from.id),
      JSON.stringify(response),
      false,
      1
    )

    this.publishAllowedChat(request.from.id)
  }

  rejectRequest(request: PrivateChatRequest) {
    this.processedRequestIds.add(request.id)

    const response = {
      requestId: request.id,
      from: this.currentUser.id,
      to: request.from.id,
      accepted: false,
      timestamp: new Date().toISOString(),
      type: 'chat_response'
    }

    this.removeRequest(request.id)

    this.mqttService.publish(
      MqttTopics.privateChat.response(request.from.id),
      JSON.stringify(response),
      false,
      1
    )
  }

  cancelRequest(request: PrivateChatRequest) {
    const payload = {
      requestId: request.id,
      from: this.currentUser.id,
      to: request.to,
      cancelled: true,
      timestamp: new Date().toISOString(),
      type: 'chat_cancel'
    }

    const sentRequests = this.sentRequestsSubject.value.filter((r) => r.id !== request.id)
    this.sentRequestsSubject.next(sentRequests)

    this.mqttService.publish(
      MqttTopics.privateChat.request(request.to),
      JSON.stringify(payload),
      false,
      1
    )
  }

  isAllowedToChat(userId: string): boolean {
    return this.allowedChatsSubject.value.has(userId)
  }

  hasPendingRequest(userId: string): boolean {
    const received = this.requestsSubject.value.some(
      (req) => req.from.id === userId && req.status === 'pending'
    )
    const sent = this.sentRequestsSubject.value.some(
      (req) => req.to === userId && req.status === 'pending'
    )
    return received || sent
  }

  getPendingRequestCount(): number {
    return this.requestsSubject.value.filter((req) => req.status === 'pending').length
  }

  private handleIncomingRequest(message: string) {
    const data = JSON.parse(message)

    if (data.type === 'chat_cancel') {
      this.removeRequest(data.requestId)
      return
    }

    if (this.processedRequestIds.has(data.id)) {
      return
    }

    if (data.from.id === this.currentUser.id) {
      return
    }

    const exists = this.requestsSubject.value.some((req) => req.id === data.id)
    if (exists) {
      return
    }

    const request: PrivateChatRequest = {
      id: data.id,
      from: new User(data.from.id, data.from.name, true, new Date()),
      to: data.to,
      timestamp: new Date(data.timestamp),
      status: 'pending'
    }

    const requests = [...this.requestsSubject.value, request]
    this.requestsSubject.next(requests)
  }

  private handleRequestResponse(message: string) {
    const data = JSON.parse(message)

    if (data.type !== 'chat_response') {
      return
    }

    const sentRequest = this.sentRequestsSubject.value.find((req) => req.id === data.requestId)

    if (!sentRequest) {
      return
    }

    if (data.accepted) {
      this.addAllowedChat(data.from)

      sentRequest.status = 'accepted'
    } else {
      sentRequest.status = 'rejected'
    }

    setTimeout(() => {
      const sentRequests = this.sentRequestsSubject.value.filter((req) => req.id !== data.requestId)
      this.sentRequestsSubject.next(sentRequests)
    }, 3000)
  }

  private removeRequest(requestId: string) {
    const requests = this.requestsSubject.value.filter((req) => req.id !== requestId)
    this.requestsSubject.next(requests)
  }

  private addAllowedChat(userId: string) {
    const allowedChats = new Set(this.allowedChatsSubject.value)
    allowedChats.add(userId)
    this.allowedChatsSubject.next(allowedChats)
  }

  private publishAllowedChat(userId: string) {
    const payload = {
      user: this.currentUser.id,
      allowedChat: userId,
      timestamp: new Date().toISOString()
    }

    this.mqttService.publish(
      MqttTopics.privateChat.allowed(this.currentUser.id),
      JSON.stringify(payload),
      true, // retained
      1
    )
  }

  private requestAllowedChats() {
    this.mqttService.subscribe(MqttTopics.privateChat.allowed(this.currentUser.id), (message) => {
      const data = JSON.parse(message)
      if (data.allowedChat) {
        this.addAllowedChat(data.allowedChat)
      }
    })
  }

  onDisconnect() {
    this.requestsSubject.next([])
    this.sentRequestsSubject.next([])
  }
}
