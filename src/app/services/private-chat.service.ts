import { Injectable } from '@angular/core'
import { BehaviorSubject, map } from 'rxjs'
import { MqttTopics } from '../config/mqtt-topics'
import { NotificationStatus, User } from '../models'
import { MqttService, AppStateService, IdGeneratorService } from '.'
import { PrivateChatNotification } from '../models'

@Injectable({
  providedIn: 'root'
})
export class PrivateChatRequestService {
  private allowedChatsSubject = new BehaviorSubject<Set<string>>(new Set())
  private notificationsSubject = new BehaviorSubject<PrivateChatNotification[]>([])

  public allowedChats$ = this.allowedChatsSubject.asObservable()
  public notifications$ = this.notificationsSubject.asObservable()

  public requests$ = this.notifications$.pipe(
    map((notifications) =>
      notifications.filter((n) => n.type === 'request_received' && n.status.isPending)
    )
  )
  public sentRequests$ = this.notifications$.pipe(
    map((notifications) =>
      notifications.filter((n) => n.type === 'request_sent' && n.status.isPending)
    )
  )

  private currentUser!: User
  private processedRequestIds = new Set<string>()
  private userSessionTopics = new Map<string, string>()
  private sessionMessageCallback?: (message: string) => void

  constructor(
    private mqttService: MqttService,
    private appState: AppStateService,
    private idGenerator: IdGeneratorService
  ) {}

  initialize() {
    this.currentUser = this.appState.user!

    this.requestPendingNotifications()

    this.mqttService.subscribe(MqttTopics.control(this.currentUser.id), (message) => {
      this.handleControlMessage(message)
    })

    this.mqttService.subscribe(MqttTopics.pendingSync(this.currentUser.id), (message) => {
      this.handlePendingNotifications(message)
    })
  }

  setSessionMessageCallback(callback: (message: string) => void) {
    this.sessionMessageCallback = callback
  }

  private requestPendingNotifications() {
    const request = {
      type: 'pending_notifications_request',
      userId: this.currentUser.id,
      timestamp: new Date().toISOString()
    }

    this.mqttService.publish(MqttTopics.pendingSync(this.currentUser.id),JSON.stringify(request))
  }

  private handlePendingNotifications(message: string) {
    const data = JSON.parse(message)

    if (data.type === 'pending_notifications' && data.forUserId === this.currentUser.id) {
      data.notifications?.forEach((notificationData: any) => {
        const exists = this.notificationsSubject.value.some(
          (n) => n.requestId === notificationData.requestId
        )

        if (!exists) {
          const notification = new PrivateChatNotification(
            notificationData.id,
            notificationData.type,
            notificationData.relatedUser,
            notificationData.requestId,
            new Date(notificationData.timestamp),
            notificationData.status
          )
          this.notificationsSubject.next([...this.notificationsSubject.value, notification])
        }
      })
    }
  }

  private handleControlMessage(message: string) {
    const data = JSON.parse(message)
    
    switch (data.type) {
      case 'chat_request':
        this.handleIncomingRequest(message)
        break
      case 'chat_response':
        this.handleRequestResponse(message)
        break
      case 'session_created':
        this.handleSessionCreated(data)
        break
    }
  }

  private handleSessionCreated(data: any) {
    if (data.requestId && this.processedRequestIds.has(data.requestId)) {
      const topicName = data.topicName
      const userId = data.userId
      
      this.userSessionTopics.set(userId, topicName)
      
      const updatedChats = new Set([...this.allowedChatsSubject.value, topicName, userId])
      this.allowedChatsSubject.next(updatedChats)
      
      if (this.sessionMessageCallback) {
        this.mqttService.subscribe(topicName, this.sessionMessageCallback)
      }
    }
  }

  sendChatRequest(targetUser: User): boolean {
    if (!this.canSendRequestTo(targetUser.id)) {
      return false
    }

    if (this.hasPendingRequest(targetUser.id)) {
      return false
    }

    const requestId = this.idGenerator.generateId('chat_req_')
    
    this.processedRequestIds.add(requestId)

    const notification = {
      id: this.idGenerator.generateId('notif'),
      type: 'request_sent' as const,
      relatedUser: targetUser,
      requestId: requestId,
      timestamp: new Date(),
      status: NotificationStatus.pending
    }

    this.addNotification(notification)

    const payload = {
      id: requestId,
      from: {
        id: this.currentUser.id,
        name: this.currentUser.name
      },
      to: targetUser.id,
      timestamp: new Date().toISOString(),
      type: 'chat_request',
      sessionId: `${this.currentUser.id}_${targetUser.id}_${Date.now()}`,
      notification: notification
    }

    this.mqttService.publish(MqttTopics.control(targetUser.id),JSON.stringify(payload))

    return true
  }

  acceptRequest(notificationId: string) {
    const notification = this.notificationsSubject.value.find((n) => n.id === notificationId)
    if (!notification || notification.type !== 'request_received') {
      return
    }

    this.processedRequestIds.add(notification.requestId)

    const sessionTopic = `${this.currentUser.id}_${notification.relatedUser.id}_${Date.now()}`

    const response = {
      requestId: notification.requestId,
      from: this.currentUser.id,
      to: notification.relatedUser.id,
      accepted: true,
      timestamp: new Date().toISOString(),
      type: 'chat_response',
      sessionTopic
    }

    this.mqttService.publish(MqttTopics.control(notification.relatedUser.id),JSON.stringify(response))

    this.mqttService.publish(
      MqttTopics.control(notification.relatedUser.id),
      JSON.stringify({
        type: 'session_created',
        requestId: notification.requestId,
        topicName: sessionTopic,
        userId: this.currentUser.id
      })
    )

    this.updateNotificationStatus(notificationId, NotificationStatus.accepted)
    
    this.userSessionTopics.set(notification.relatedUser.id, sessionTopic)
    
    if (this.sessionMessageCallback) {
      this.mqttService.subscribe(sessionTopic, this.sessionMessageCallback)
    }
    
    const updatedChats = new Set([...this.allowedChatsSubject.value, sessionTopic, notification.relatedUser.id])
    this.allowedChatsSubject.next(updatedChats)
  }

  rejectRequest(notificationId: string) {
    const notification = this.notificationsSubject.value.find((n) => n.id === notificationId)
    if (!notification || notification.type !== 'request_received') {
      return
    }

    this.processedRequestIds.add(notification.requestId)

    const response = {
      requestId: notification.requestId,
      from: this.currentUser.id,
      to: notification.relatedUser.id,
      accepted: false,
      timestamp: new Date().toISOString(),
      type: 'chat_response'
    }

    this.updateNotificationStatus(notificationId, NotificationStatus.rejected)

    this.mqttService.publish(MqttTopics.control(notification.relatedUser.id),JSON.stringify(response))
  }

  getPendingReceivedCount(): number {
    return this.notificationsSubject.value.filter(
      (notif) => notif.type === 'request_received' && notif.status.isPending
    ).length
  }

  isAllowedToChat(userId: string): boolean {
    return this.allowedChatsSubject.value.has(userId)
  }

  getSessionTopic(userId: string): string | undefined {
    return this.userSessionTopics.get(userId)
  }

  hasPendingRequest(userId: string): boolean {
    return this.notificationsSubject.value.some(
      (notif) =>
        notif.relatedUser.id === userId &&
        notif.status.isPending &&
        (notif.type === 'request_received' || notif.type === 'request_sent')
    )
  }

  private handleIncomingRequest(message: string) {
    const data = JSON.parse(message)

    if (data.from.id === this.currentUser.id || data.to !== this.currentUser.id) {
      return
    }

    const exists = this.notificationsSubject.value.some((notif) => notif.requestId === data.id)
    if (exists) {
      return
    }

    const user = new User(data.from.id, data.from.name)

    this.addNotification({
      id: this.idGenerator.generateId('notif'),
      type: 'request_received',
      relatedUser: user,
      requestId: data.id,
      timestamp: new Date(data.timestamp),
      status: NotificationStatus.pending
    })
  }

  private handleRequestResponse(message: string) {
    const data = JSON.parse(message)

    if (data.type !== 'chat_response') {
      return
    }

    const notification = this.notificationsSubject.value.find(
      (notif) => notif.requestId === data.requestId && notif.type === 'request_sent'
    )

    if (!notification) {
      return
    }

    if (data.accepted) {
      if (data.sessionTopic) {
        this.userSessionTopics.set(data.from, data.sessionTopic)
        
        const updatedChats = new Set([...this.allowedChatsSubject.value, data.sessionTopic, data.from])
        this.allowedChatsSubject.next(updatedChats)
        
        if (this.sessionMessageCallback) {
          this.mqttService.subscribe(data.sessionTopic, this.sessionMessageCallback)
        }
      }
      
      this.updateNotificationByRequestId(data.requestId, NotificationStatus.accepted)
    } else {
      this.updateNotificationByRequestId(data.requestId, NotificationStatus.rejected)
    }
  }

  private updateNotificationStatus(notificationId: string, status: NotificationStatus) {
    const notifications: PrivateChatNotification[] = this.notificationsSubject.value.map((notif) =>
      notif.id === notificationId
        ? {
            ...notif,
            status: status as NotificationStatus,
            timestamp: new Date()
          }
        : notif
    )
    this.notificationsSubject.next(notifications)
  }

  private updateNotificationByRequestId(requestId: string, status: NotificationStatus) {
    const notifications: PrivateChatNotification[] = this.notificationsSubject.value.map((notif) =>
      notif.requestId === requestId
        ? {
            ...notif,
            status: status as NotificationStatus,
            timestamp: new Date(),
            read: false
          }
        : notif
    )
    this.notificationsSubject.next(notifications)
  }

  private addNotification(notification: PrivateChatNotification) {
    const notifications = [...this.notificationsSubject.value, notification]
    this.notificationsSubject.next(notifications)
  }

  canSendRequestTo(userId: string): boolean {
    if (userId === this.currentUser.id) {
      return false
    }

    if (this.isAllowedToChat(userId)) {
      return false
    }

    if (this.hasPendingRequest(userId)) {
      return false
    }

    return true
  }
}
