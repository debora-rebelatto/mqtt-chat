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

  constructor(
    private mqttService: MqttService,
    private appState: AppStateService,
    private idGenerator: IdGeneratorService
  ) {}

  initialize() {
    this.currentUser = this.appState.user!

    this.requestPendingNotifications()

    this.mqttService.subscribe(MqttTopics.privateChat.request(this.currentUser.id), (message) => {
      this.handleIncomingRequest(message)
    })

    this.mqttService.subscribe(MqttTopics.privateChat.response(this.currentUser.id), (message) => {
      this.handleRequestResponse(message)
    })

    this.mqttService.subscribe(MqttTopics.pendingSync(this.currentUser.id), (message) => {
      this.handlePendingNotifications(message)
    })

    this.requestAllowedChats()
  }

  private requestPendingNotifications() {
    const request = {
      type: 'pending_notifications_request',
      userId: this.currentUser.id,
      timestamp: new Date().toISOString()
    }

    this.mqttService.publish(
      MqttTopics.pendingSync(this.currentUser.id),
      JSON.stringify(request),
      true,
      1
    )
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

  sendChatRequest(targetUser: User): boolean {
    if (!this.canSendRequestTo(targetUser.id)) {
      return false
    }

    if (this.hasPendingRequest(targetUser.id)) {
      return false
    }

    const requestId = this.idGenerator.generateId('chat_req_')

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
      notification: notification
    }

    this.mqttService.publish(
      MqttTopics.privateChat.request(targetUser.id),
      JSON.stringify(payload),
      false,
      1
    )

    return true
  }

  acceptRequest(notificationId: string) {
    const notification = this.notificationsSubject.value.find((n) => n.id === notificationId)
    if (!notification || notification.type !== 'request_received') {
      return
    }

    this.processedRequestIds.add(notification.requestId)

    const response = {
      requestId: notification.requestId,
      from: this.currentUser.id,
      to: notification.relatedUser.id,
      accepted: true,
      timestamp: new Date().toISOString(),
      type: 'chat_response'
    }

    this.addAllowedChat(notification.relatedUser.id)

    this.updateNotificationStatus(notificationId, NotificationStatus.accepted)

    this.mqttService.publish(
      MqttTopics.privateChat.response(notification.relatedUser.id),
      JSON.stringify(response),
      false,
      1
    )

    this.publishAllowedChat(notification.relatedUser.id)
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

    this.mqttService.publish(
      MqttTopics.privateChat.response(notification.relatedUser.id),
      JSON.stringify(response),
      false,
      1
    )
  }

  getPendingReceivedCount(): number {
    return this.notificationsSubject.value.filter(
      (notif) => notif.type === 'request_received' && notif.status.isPending
    ).length
  }

  isAllowedToChat(userId: string): boolean {
    return this.allowedChatsSubject.value.has(userId)
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
      this.addAllowedChat(data.from)

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
      true,
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
