import { ChatType } from "./chat-type.component"

export interface ChatMessage {
  id: string
  sender: string
  content: string
  timestamp: Date
  fromCurrentUser: boolean
  chatType: ChatType
  chatId?: string
}

