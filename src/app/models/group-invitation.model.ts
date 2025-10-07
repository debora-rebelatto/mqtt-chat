import { User } from "./user.model"

export class GroupInvitation {
  id: string
  groupId: string
  groupName: string
  invitee: User
  timestamp: Date

  constructor(
    id: string,
    groupId: string,
    groupName: string,
    invitee: User,
    timestamp: Date = new Date()
  ) {
    this.id = id
    this.groupId = groupId
    this.groupName = groupName
    this.invitee = invitee
    this.timestamp = timestamp
  }
}
