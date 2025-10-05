export interface User {
  id: string
  name: string
  online: boolean
  lastSeen: Date | null
  unread?: number
}
