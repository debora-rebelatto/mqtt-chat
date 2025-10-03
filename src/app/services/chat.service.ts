import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { ChatMessage } from '../models/chat-message.model'
import { MqttService } from './mqtt.service'

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([])
  public messages$ = this.messagesSubject.asObservable()

  private currentChatSubject = new BehaviorSubject<{ type: string; id: string } | null>(null)
  public currentChat$ = this.currentChatSubject.asObservable()
  
  private readonly STORAGE_KEY = 'mqtt-chat-messages'

  constructor(private mqttService: MqttService) {
    this.loadMessagesFromStorage()
  }

  initialize(username: string) {
    this.mqttService.subscribe(`meu-chat-mqtt/messages/${username}`, (message) => {
      this.handleUserMessage(message, username)
    })

    this.mqttService.subscribe('meu-chat-mqtt/groups/+/messages', (message) => {
      this.handleGroupMessage(message, username)
    })
  }

  setCurrentChat(type: string, id: string) {
    this.currentChatSubject.next({ type, id })
  }

  sendUserMessage(from: string, to: string, content: string) {
    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(16).substring(2, 8)}`,
      sender: from,
      content: content,
      timestamp: new Date(),
      fromCurrentUser: true,
      chatType: 'user',
      chatId: to
    }

    const payload = {
      from: from,
      to: to,
      content: content,
      timestamp: message.timestamp.toISOString(),
      messageId: message.id
    }

    this.mqttService.publish(`meu-chat-mqtt/messages/${to}`, JSON.stringify(payload))

    this.addMessage(message)
  }

  sendGroupMessage(groupId: string, sender: string, content: string) {
    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(16).substring(2, 8)}`,
      sender: sender,
      content: content,
      timestamp: new Date(),
      fromCurrentUser: true,
      chatType: 'group',
      chatId: groupId
    }

    const payload = {
      groupId: groupId,
      sender: sender,
      content: content,
      timestamp: message.timestamp.toISOString(),
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
      chatType: 'user',
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
      chatType: 'group',
      chatId: data.groupId
    }

    this.addMessage(chatMessage)
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

  getMessagesForChat(type: string, chatId: string): ChatMessage[] {
    return this.messagesSubject.value.filter(
      (m) => m.chatType === type && m.chatId === chatId
    )
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
}
