import { ChatType } from './chat-type.model'
import { User } from './user.model'

export class Message {
  id: string
  sender: User
  content: string
  timestamp: Date
  chatType: ChatType
  chatId: string

  constructor(
    id: string,
    sender: User,
    content: string,
    timestamp: Date,
    chatType: ChatType,
    chatId: string
  ) {
    this.id = id
    this.sender = sender
    this.content = content
    this.timestamp = timestamp
    this.chatType = chatType
    this.chatId = chatId
  }
}
