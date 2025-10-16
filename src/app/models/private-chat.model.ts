import { NotificationStatus } from './notification-status.model'
import { User } from './user.model'

export type NotificationType = 'request_received' | 'request_sent'

export class PrivateChatNotification {
  id: string
  type: NotificationType
  relatedUser: User
  requestId: string
  timestamp: Date
  status: NotificationStatus

  constructor(
    id: string,
    type: NotificationType,
    relatedUser: User,
    requestId: string,
    timestamp: Date,
    status: NotificationStatus
  ) {
    this.id = id
    this.type = type
    this.relatedUser = relatedUser
    this.requestId = requestId
    this.timestamp = timestamp
    this.status = status
  }
}
