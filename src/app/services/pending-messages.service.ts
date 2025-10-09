// pending-messages.service.ts
import { Injectable } from '@angular/core'
import { Message, User } from '../models'
import { MqttService } from './mqtt.service'
import { MqttTopics } from '../config/mqtt-topics'

@Injectable({
  providedIn: 'root'
})
export class PendingMessagesService {
  private pendingMessages: Map<string, Message[]> = new Map()
  private readonly STORAGE_KEY = 'mqtt-chat-pending-messages'

  constructor(private mqttService: MqttService) {
    this.loadFromStorage()
  }

  addPendingMessage(toUserId: string, message: Message): void {
    if (!this.pendingMessages.has(toUserId)) {
      this.pendingMessages.set(toUserId, [])
    }

    const userPendingMessages = this.pendingMessages.get(toUserId)!

    if (!userPendingMessages.some((msg) => msg.id === message.id)) {
      userPendingMessages.push(message)
      this.saveToStorage()
    }
  }

  removePendingMessage(messageId: string, userId: string): boolean {
    const pending = this.pendingMessages.get(userId)
    if (pending) {
      const initialLength = pending.length
      const filteredMessages = pending.filter((msg) => msg.id !== messageId)

      if (filteredMessages.length !== initialLength) {
        this.pendingMessages.set(userId, filteredMessages)
        this.saveToStorage()
        return true
      }
    }
    return false
  }

  getPendingMessagesForUser(userId: string): Message[] {
    return this.pendingMessages.get(userId) || []
  }

  clearPendingMessagesForUser(userId: string): void {
    if (this.pendingMessages.has(userId)) {
      this.pendingMessages.delete(userId)
      this.saveToStorage()
    }
  }

  hasPendingMessages(userId: string): boolean {
    const pending = this.pendingMessages.get(userId)
    return pending ? pending.length > 0 : false
  }

  getTotalPendingCount(): number {
    let total = 0
    this.pendingMessages.forEach((messages) => {
      total += messages.length
    })
    return total
  }

  getUsersWithPendingMessages(): string[] {
    return Array.from(this.pendingMessages.keys()).filter((userId) =>
      this.hasPendingMessages(userId)
    )
  }

  async sendPendingMessagesToUser(userId: string): Promise<void> {
    const pending = this.pendingMessages.get(userId)
    if (!pending || pending.length === 0) return

    const messagesToSend = [...pending]

    this.clearPendingMessagesForUser(userId)

    for (let i = 0; i < messagesToSend.length; i++) {
      const message = messagesToSend[i]
      const success = await this.sendSinglePendingMessage(userId, message)

      if (!success) {
        this.addPendingMessage(userId, message)
      }

      if (i < messagesToSend.length - 1) {
        await this.delay(200)
      }
    }
  }

  private async sendSinglePendingMessage(userId: string, message: Message): Promise<boolean> {
    const mqttPayload = {
      id: message.id,
      sender: message.sender.id,
      content: message.content,
      timestamp: message.timestamp.toISOString(),
      chatType: message.chatType,
      chatId: message.chatId,
      isOfflineMessage: true
    }

    return this.mqttService.publish(
      MqttTopics.privateMessage(userId),
      JSON.stringify(mqttPayload),
      false,
      1
    )
  }

  clearAll(): void {
    this.pendingMessages.clear()
    localStorage.removeItem(this.STORAGE_KEY)
  }

  private saveToStorage(): void {
    const pendingData: { [key: string]: any[] } = {}

    this.pendingMessages.forEach((messages, userId) => {
      pendingData[userId] = messages.map((msg) => this.serializeMessage(msg))
    })

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(pendingData))
  }

  private loadFromStorage(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY)
    if (stored) {
      try {
        const pendingData = JSON.parse(stored)

        Object.entries(pendingData).forEach(([userId, messages]: [string, any]) => {
          const parsedMessages = messages.map((msgData: any) => this.deserializeMessage(msgData))
          this.pendingMessages.set(userId, parsedMessages)
        })
      } catch (error) {
        console.error('Erro ao carregar mensagens pendentes:', error)
        localStorage.removeItem(this.STORAGE_KEY)
      }
    }
  }

  private serializeMessage(message: Message): any {
    return {
      id: message.id,
      sender: {
        id: message.sender.id,
        name: message.sender.name,
        online: message.sender.online,
        lastSeen: message.sender.lastSeen
      },
      content: message.content,
      timestamp: message.timestamp.toISOString(),
      chatType: message.chatType,
      chatId: message.chatId
    }
  }

  private deserializeMessage(msgData: any): Message {
    const sender = new User(
      msgData.sender.id,
      msgData.sender.name,
      msgData.sender.online || false,
      msgData.sender.lastSeen ? new Date(msgData.sender.lastSeen) : new Date()
    )

    return new Message(
      msgData.id,
      sender,
      msgData.content,
      new Date(msgData.timestamp),
      msgData.chatType,
      msgData.chatId
    )
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
