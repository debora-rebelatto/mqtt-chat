import { Injectable } from '@angular/core'
import { Message } from '../models'
import { MqttService } from './mqtt.service'
import { MqttTopics } from '../config/mqtt-topics'
import { PrivateChatRequestService } from './private-chat.service'

@Injectable({
  providedIn: 'root'
})
export class PendingMessagesService {
  private pendingMessages: Map<string, Message[]> = new Map()
  private sendingInProgress: Set<string> = new Set()

  constructor(
    private mqttService: MqttService,
    private privateChatService: PrivateChatRequestService
  ) {}

  addPendingMessage(toUserId: string, message: Message): void {
    if (!this.pendingMessages.has(toUserId)) {
      this.pendingMessages.set(toUserId, [])
    }

    const userPendingMessages = this.pendingMessages.get(toUserId)!

    if (!userPendingMessages.some((msg) => msg.id === message.id)) {
      userPendingMessages.push(message)
    }
  }

  removePendingMessage(messageId: string, userId: string): boolean {
    const pending = this.pendingMessages.get(userId)
    if (pending) {
      const initialLength = pending.length
      const filteredMessages = pending.filter((msg) => msg.id !== messageId)

      if (filteredMessages.length !== initialLength) {
        this.pendingMessages.set(userId, filteredMessages)
        return true
      }
    }
    return false
  }

  clearPendingMessagesForUser(userId: string): void {
    if (this.pendingMessages.has(userId)) {
      this.pendingMessages.delete(userId)
    }
  }

  async sendPendingMessagesToUser(userId: string): Promise<void> {
    if (this.sendingInProgress.has(userId)) {
      return
    }

    const pending = this.pendingMessages.get(userId)
    if (!pending || pending.length === 0) {
      return
    }

    this.sendingInProgress.add(userId)

    const messagesToSend = [...pending]
    this.clearPendingMessagesForUser(userId)

    try {
      for (let i = 0; i < messagesToSend.length; i++) {
        const message = messagesToSend[i]

        const success = await this.sendSinglePendingMessage(userId, message)

        if (!success) {
          this.addPendingMessage(userId, message)
        }
      }
    } finally {
      this.sendingInProgress.delete(userId)
    }
  }

  private async sendSinglePendingMessage(userId: string, message: Message): Promise<boolean> {
    const sessionTopic = this.privateChatService.getSessionTopic(userId)!

    const mqttPayload = {
      id: message.id,
      sender: message.sender.id,
      senderName: message.sender.name,
      content: message.content,
      timestamp: message.timestamp.toISOString(),
      chatType: message.chatType,
      chatId: message.chatId,
      isOfflineMessage: true
    }

    return this.mqttService.publish(sessionTopic, JSON.stringify(mqttPayload))
  }
}
