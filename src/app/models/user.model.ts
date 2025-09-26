export interface User {
  id: string
  status: 'online' | 'offline'
  lastSeen?: Date
}
