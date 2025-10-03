export interface User {
  id: string
  name: string
  online: boolean
  lastSeen: string | null
  unread: number
}
