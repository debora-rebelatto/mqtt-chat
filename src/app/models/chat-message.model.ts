export interface ChatMessage {
  id: string
  sender: string
  content: string
  timestamp: Date
  fromCurrentUser: boolean
  chatType: 'user' | 'group'
  chatId: string
}
