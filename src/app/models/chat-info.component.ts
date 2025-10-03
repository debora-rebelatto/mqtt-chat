export interface ChatInfo {
  type: 'user' | 'group'
  id: string
  name: string
  unreadCount?: number
}
