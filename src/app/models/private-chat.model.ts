import { NotificationStatus } from './notification-status.model'
import { User } from './user.model'

export type NotificationType = 'request_received' | 'request_sent'

export interface PrivateChatNotification {
  id: string
  type: NotificationType
  relatedUser: User
  requestId: string
  timestamp: Date
  status: NotificationStatus
}
