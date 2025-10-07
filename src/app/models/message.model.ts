import { ChatType } from './chat-type.component'
import { User } from './user.model'

export class Message {
  id: string
  sender: User
  content: string
  timestamp: Date
  fromCurrentUser: boolean
  chatType: ChatType
  chatId?: string

  constructor(
    id: string,
    sender: User,
    content: string,
    timestamp: Date,
    fromCurrentUser: boolean,
    chatType: ChatType,
    chatId: string
  ) {
    this.id = id
    this.sender = sender
    this.content = content
    this.timestamp = timestamp
    this.fromCurrentUser = fromCurrentUser
    this.chatType = chatType
    this.chatId = chatId
  }
}
