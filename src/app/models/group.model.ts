import { User } from './user.model'

export class Group {
  id: string
  name: string
  leader: User
  members: User[]
  createdAt: Date
  unread?: number

  constructor(
    id: string,
    name: string,
    leader: User,
    members: User[] = [],
    createdAt: Date = new Date(),
    unread?: number
  ) {
    this.id = id
    this.name = name
    this.leader = leader
    this.members = members
    this.createdAt = createdAt
    this.unread = unread
  }
}
