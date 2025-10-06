import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { ChatMessage } from '../models/chat-message.model'
import { MqttService } from './mqtt.service'
import { ChatType } from '../models/chat-type.component'

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([])
  public messages$ = this.messagesSubject.asObservable()

  private currentChatSubject = new BehaviorSubject<{ type: 'user' | 'group'; id: string } | null>(
    null
  )
  public currentChat$ = this.currentChatSubject.asObservable()

  private readonly STORAGE_KEY = 'mqtt-chat-messages'
  private readonly PENDING_MESSAGES_KEY = 'mqtt-chat-pending-messages'
  private pendingMessages: { [username: string]: ChatMessage[] } = {}

  constructor(private mqttService: MqttService) {
    this.loadMessagesFromStorage()
    this.loadPendingMessages()
  }

  initialize(username: string) {
    this.mqttService.subscribe(`meu-chat-mqtt/messages/${username}`, (message) => {
      this.handleUserMessage(message, username)
    })

    this.mqttService.subscribe('meu-chat-mqtt/groups/+/messages', (message) => {
      this.handleGroupMessage(message, username)
    })

    this.mqttService.subscribe(`meu-chat-mqtt/sync/pending/${username}`, (message) => {
      this.handlePendingSync(message, username)
    })
  }

  subscribeToGroup(groupId: string, username: string) {
    this.mqttService.subscribe(`meu-chat-mqtt/groups/${groupId}/messages`, (message) => {
      this.handleGroupMessage(message, username)
    })
  }

  setCurrentChat(type: 'user' | 'group', id: string) {
    this.currentChatSubject.next({ type, id })
  }

  sendUserMessage(from: string, to: string, content: string) {
    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(16).substring(2, 8)}`,
      sender: from,
      content: content,
      timestamp: new Date(),
      fromCurrentUser: true,
      chatType: ChatType.User,
      chatId: to
    }

    const payload = {
      from: from,
      to: to,
      content: content,
      timestamp: message.timestamp instanceof Date ? message.timestamp.toISOString() : new Date(message.timestamp).toISOString(),
      messageId: message.id
    }

    this.mqttService.publish(`meu-chat-mqtt/messages/${to}`, JSON.stringify(payload))
    this.addPendingMessage(to, message)
    this.addMessage(message)
  }

  sendGroupMessage(groupId: string, sender: string, content: string) {
    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(16).substring(2, 8)}`,
      sender: sender,
      content: content,
      timestamp: new Date(),
      fromCurrentUser: true,
      chatType: ChatType.Group,
      chatId: groupId
    }

    const payload = {
      groupId: groupId,
      sender: sender,
      content: content,
      timestamp: message.timestamp instanceof Date ? message.timestamp.toISOString() : new Date(message.timestamp).toISOString(),
      messageId: message.id
    }

    this.mqttService.publish(`meu-chat-mqtt/groups/${groupId}/messages`, JSON.stringify(payload))
    this.addMessage(message)
  }

  private handleUserMessage(message: string, currentUsername: string) {
    const data = JSON.parse(message)

    const chatMessage: ChatMessage = {
      id: data.messageId || `msg_${Date.now()}`,
      sender: data.from,
      content: data.content,
      timestamp: new Date(data.timestamp),
      fromCurrentUser: data.from === currentUsername,
      chatType: ChatType.User,
      chatId: data.from === currentUsername ? data.to : data.from
    }

    this.addMessage(chatMessage)
  }

  private handleGroupMessage(message: string, currentUsername: string) {
    const data = JSON.parse(message)

    const chatMessage: ChatMessage = {
      id: data.messageId || `msg_${Date.now()}`,
      sender: data.sender,
      content: data.content,
      timestamp: new Date(data.timestamp),
      fromCurrentUser: data.sender === currentUsername,
      chatType: ChatType.Group,
      chatId: data.groupId
    }

    this.addMessage(chatMessage)
  }

  private handlePendingSync(message: string, currentUsername: string) {
    const data = JSON.parse(message)

    if (data.type === 'request_pending') {
      const pendingMessages = this.getPendingMessages(currentUsername)
      pendingMessages.forEach((msg) => {
        this.addMessage(msg)
      })
    }
  }

  private addMessage(message: ChatMessage) {
    const messages = this.messagesSubject.value
    const exists = messages.some((m) => m.id === message.id)


    if (!exists) {
      const updatedMessages = [...messages, message]
      this.messagesSubject.next(updatedMessages)
      this.saveMessagesToStorage(updatedMessages)
    }
  }

  getMessagesForChat(type: 'user' | 'group', chatId: string): ChatMessage[] {
    const messages = this.messagesSubject.value.filter((m) => {
      const typeMatch = m.chatType === type || m.chatType === (type === 'user' ? ChatType.User : ChatType.Group)
      return typeMatch && m.chatId === chatId
    })

    return messages
  }

  clearMessages() {
    this.messagesSubject.next([])
    this.saveMessagesToStorage([])
  }

  private loadMessagesFromStorage() {
    const stored = localStorage.getItem(this.STORAGE_KEY)
    if (stored) {
      const messages = JSON.parse(stored).map((msg: ChatMessage & { timestamp: string }) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))
      this.messagesSubject.next(messages)
    }
  }

  private saveMessagesToStorage(messages: ChatMessage[]) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(messages))
  }

  forceSave() {
    this.saveMessagesToStorage(this.messagesSubject.value)
  }

  forceLoad() {
    this.loadMessagesFromStorage()
  }

  getStoredMessagesCount(): number {
    return this.messagesSubject.value.length
  }

  private loadPendingMessages() {
    const stored = localStorage.getItem(this.PENDING_MESSAGES_KEY)
    if (stored) {
      this.pendingMessages = JSON.parse(stored)
    }
  }

  private savePendingMessages() {
    localStorage.setItem(this.PENDING_MESSAGES_KEY, JSON.stringify(this.pendingMessages))
  }

  addPendingMessage(username: string, message: ChatMessage) {
    if (!this.pendingMessages[username]) {
      this.pendingMessages[username] = []
    }
    this.pendingMessages[username].push(message)
    this.savePendingMessages()
  }

  getPendingMessages(username: string): ChatMessage[] {
    const pending = this.pendingMessages[username] || []
    delete this.pendingMessages[username]
    this.savePendingMessages()
    return pending
  }

  hasPendingMessages(username: string): boolean {
    return !!(this.pendingMessages[username] && this.pendingMessages[username].length > 0)
  }
}
