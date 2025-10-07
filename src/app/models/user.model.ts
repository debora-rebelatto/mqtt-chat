export class User {
  id: string
  name: string
  online?: boolean
  lastSeen?: Date
  unread?: number

  constructor(id: string, name: string, online: boolean = true, lastSeen?: Date) {
    this.id = id
    this.name = name || id
    this.online = online
    this.lastSeen = lastSeen || new Date()
  }
}
