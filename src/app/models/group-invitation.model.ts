import { NotificationStatus } from './notification-status.model'
import { User } from './user.model'

export class GroupInvitation {
  id: string
  groupId: string
  groupName: string
  invitee: User
  timestamp: Date
  status?: NotificationStatus

  constructor(
    id: string,
    groupId: string,
    groupName: string,
    invitee: User,
    timestamp: Date = new Date(),
    status?: NotificationStatus
  ) {
    this.id = id
    this.groupId = groupId
    this.groupName = groupName
    this.invitee = invitee
    this.timestamp = timestamp
    this.status = status
  }
}
