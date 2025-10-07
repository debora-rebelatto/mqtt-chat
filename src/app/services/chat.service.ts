import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { ChatMessage } from '../models/chat-message.model'
import { MqttService } from './mqtt.service'
import { ChatType } from '../models/chat-type.component'
import {
  ConversationRequest,
  ConversationSession,
  ControlMessage
} from '../models/conversation-request.model'

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

  private requestsSubject = new BehaviorSubject<ConversationRequest[]>([])
  private sessionsSubject = new BehaviorSubject<ConversationSession[]>([])
  private debugHistorySubject = new BehaviorSubject<ControlMessage[]>([])

  public requests$ = this.requestsSubject.asObservable()
  public sessions$ = this.sessionsSubject.asObservable()
  public debugHistory$ = this.debugHistorySubject.asObservable()

  private readonly STORAGE_KEY = 'mqtt-chat-messages'
  private readonly PENDING_MESSAGES_KEY = 'mqtt-chat-pending-messages'
  private readonly STORAGE_KEY_REQUESTS = 'mqtt-chat-conversation-requests'
  private readonly STORAGE_KEY_SESSIONS = 'mqtt-chat-conversation-sessions'
  private readonly STORAGE_KEY_DEBUG = 'mqtt-chat-debug-history'

  private pendingMessages: { [username: string]: ChatMessage[] } = {}
  private currentUserId: string = ''

  constructor(private mqttService: MqttService) {
    this.loadMessagesFromStorage()
    this.loadPendingMessages()
    this.loadConversationData()
  }

  initialize(username: string) {
    this.currentUserId = username

    this.mqttService.subscribe(`meu-chat-mqtt/messages/${username}`, (message) => {
      this.handleUserMessage(message, username)
    })

    this.mqttService.subscribe('meu-chat-mqtt/groups/+/messages', (message) => {
      this.handleGroupMessage(message, username)
    })

    this.mqttService.subscribe(`meu-chat-mqtt/sync/pending/${username}`, (message) => {
      this.handlePendingSync(message, username)
    })

    this.setupControlSubscription(username)
  }

  subscribeToGroup(groupId: string, username: string) {
    this.mqttService.subscribe(`meu-chat-mqtt/groups/${groupId}/messages`, (message) => {
      this.handleGroupMessage(message, username)
    })
  }

  setCurrentChat(type: 'user' | 'group', id: string) {
    this.currentChatSubject.next({ type, id })
  }

  private setupControlSubscription(username: string) {
    const controlTopic = `${username}_Control`

    this.mqttService.subscribe(controlTopic, (message) => {
      this.handleControlMessage(message)
    })
  }

  private handleControlMessage(message: string) {
    try {
      const controlMsg: ControlMessage = JSON.parse(message)

      this.addToDebugHistory(controlMsg)

      switch (controlMsg.type) {
        case 'conversation_request':
          this.handleConversationRequest(controlMsg)
          break
        case 'conversation_accept':
          this.handleConversationAccept(controlMsg)
          break
        case 'conversation_reject':
          this.handleConversationReject(controlMsg)
          break
      }
    } catch (error) {
      console.error('Erro ao processar mensagem de controle:', error)
    }
  }

  requestConversation(targetUserId: string): string {
    const requestId = `req_${Date.now()}_${Math.random().toString(16).substring(2, 8)}`

    const request: ConversationRequest = {
      id: requestId,
      from: this.currentUserId,
      to: targetUserId,
      timestamp: new Date(),
      status: 'pending'
    }

    const requests = this.requestsSubject.value
    this.requestsSubject.next([...requests, request])
    this.saveConversationData()

    const controlMsg: ControlMessage = {
      type: 'conversation_request',
      requestId: requestId,
      from: this.currentUserId,
      to: targetUserId,
      timestamp: new Date()
    }

    this.publishToControlTopic(targetUserId, controlMsg)
    this.addToDebugHistory(controlMsg)

    return requestId
  }

  acceptConversationRequest(request: ConversationRequest) {
    const timestamp = Date.now()
    const sessionTopic = `${request.to}_${request.from}_${timestamp}`

    this.updateRequestStatus(request.id, 'accepted', sessionTopic)

    const session: ConversationSession = {
      id: `session_${timestamp}`,
      topic: sessionTopic,
      participants: [request.from, request.to],
      createdAt: new Date(),
      active: true
    }

    const sessions = this.sessionsSubject.value
    this.sessionsSubject.next([...sessions, session])
    this.saveConversationData()

    const controlMsg: ControlMessage = {
      type: 'conversation_accept',
      requestId: request.id,
      from: request.to,
      to: request.from,
      sessionTopic: sessionTopic,
      timestamp: new Date()
    }

    this.publishToControlTopic(request.from, controlMsg)
    this.addToDebugHistory(controlMsg)

    this.subscribeToSession(sessionTopic)
  }

  rejectConversationRequest(request: ConversationRequest) {
    this.updateRequestStatus(request.id, 'rejected')

    const controlMsg: ControlMessage = {
      type: 'conversation_reject',
      requestId: request.id,
      from: request.to,
      to: request.from,
      timestamp: new Date()
    }

    this.publishToControlTopic(request.from, controlMsg)
    this.addToDebugHistory(controlMsg)
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
      timestamp:
        message.timestamp instanceof Date
          ? message.timestamp.toISOString()
          : new Date(message.timestamp).toISOString(),
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
      timestamp:
        message.timestamp instanceof Date
          ? message.timestamp.toISOString()
          : new Date(message.timestamp).toISOString(),
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
      pendingMessages.forEach((msg: ChatMessage) => {
        this.addMessage(msg)
      })
    }
  }

  private getPendingMessages(username: string): ChatMessage[] {
    return this.pendingMessages[username] || []
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
    const allMessages = this.messagesSubject.value

    const messages = allMessages.filter((m) => {
      const typeMatch =
        m.chatType === type || m.chatType === (type === 'user' ? ChatType.User : ChatType.Group)

      if (type === 'user') {
        const isConversationWithUser =
          (m.sender === this.currentUserId && m.chatId === chatId) ||
          (m.sender === chatId && (m.chatId === this.currentUserId || m.chatId === chatId))
        return typeMatch && isConversationWithUser
      } else {
        return typeMatch && m.chatId === chatId
      }
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

  private addPendingMessage(username: string, message: ChatMessage) {
    if (!this.pendingMessages[username]) {
      this.pendingMessages[username] = []
    }
    this.pendingMessages[username].push(message)
    this.savePendingMessages()
  }

  private removePendingMessage(username: string, messageId: string) {
    if (this.pendingMessages[username]) {
      this.pendingMessages[username] = this.pendingMessages[username].filter(
        (msg) => msg.id !== messageId
      )
      this.savePendingMessages()
    }
  }

  private handleConversationRequest(controlMsg: ControlMessage) {
    const request: ConversationRequest = {
      id: controlMsg.requestId,
      from: controlMsg.from,
      to: controlMsg.to,
      timestamp: controlMsg.timestamp,
      status: 'pending'
    }

    const requests = this.requestsSubject.value
    const exists = requests.some((r) => r.id === request.id)

    if (!exists) {
      this.requestsSubject.next([...requests, request])
      this.saveConversationData()
    }
  }

  private handleConversationAccept(controlMsg: ControlMessage) {
    this.updateRequestStatus(controlMsg.requestId, 'accepted', controlMsg.sessionTopic)

    if (controlMsg.sessionTopic) {
      this.subscribeToSession(controlMsg.sessionTopic)
    }
  }

  private handleConversationReject(controlMsg: ControlMessage) {
    this.updateRequestStatus(controlMsg.requestId, 'rejected')
  }

  private updateRequestStatus(
    requestId: string,
    status: 'accepted' | 'rejected',
    sessionTopic?: string
  ) {
    const requests = this.requestsSubject.value
    const updatedRequests = requests.map((r) =>
      r.id === requestId ? { ...r, status, sessionTopic } : r
    )
    this.requestsSubject.next(updatedRequests)
    this.saveConversationData()
  }

  private publishToControlTopic(userId: string, message: ControlMessage) {
    const topic = `${userId}_Control`
    this.mqttService.publish(topic, JSON.stringify(message))
  }

  private subscribeToSession(sessionTopic: string) {
    this.mqttService.subscribe(sessionTopic, (message) => {
      this.handleSessionMessage(message)
    })
  }

  private handleSessionMessage(message: string) {
    const data = JSON.parse(message)
    const chatMessage: ChatMessage = {
      id: data.messageId || `msg_${Date.now()}`,
      sender: data.from,
      content: data.content,
      timestamp: new Date(data.timestamp),
      fromCurrentUser: data.from === this.currentUserId,
      chatType: ChatType.User,
      chatId: data.from === this.currentUserId ? data.to : data.from
    }

    this.addMessage(chatMessage)
  }

  private addToDebugHistory(message: ControlMessage) {
    const history = this.debugHistorySubject.value
    const newHistory = [...history, message]
    this.debugHistorySubject.next(newHistory)
    this.saveConversationData()
  }

  getPendingRequests(): ConversationRequest[] {
    return this.requestsSubject.value.filter((r) => r.status === 'pending')
  }

  getActiveSessions(): ConversationSession[] {
    return this.sessionsSubject.value.filter((s) => s.active)
  }

  private loadConversationData() {
    const requests = localStorage.getItem(this.STORAGE_KEY_REQUESTS)
    if (requests) {
      const parsedRequests = JSON.parse(requests).map(
        (r: ConversationRequest & { timestamp: string }) => ({
          ...r,
          timestamp: new Date(r.timestamp)
        })
      )
      this.requestsSubject.next(parsedRequests)
    }

    const sessions = localStorage.getItem(this.STORAGE_KEY_SESSIONS)
    if (sessions) {
      const parsedSessions = JSON.parse(sessions).map(
        (s: ConversationSession & { createdAt: string }) => ({
          ...s,
          createdAt: new Date(s.createdAt)
        })
      )
      this.sessionsSubject.next(parsedSessions)
    }

    const debug = localStorage.getItem(this.STORAGE_KEY_DEBUG)
    if (debug) {
      const parsedDebug = JSON.parse(debug).map((d: ControlMessage & { timestamp: string }) => ({
        ...d,
        timestamp: new Date(d.timestamp)
      }))
      this.debugHistorySubject.next(parsedDebug)
    }
  }

  private saveConversationData() {
    localStorage.setItem(this.STORAGE_KEY_REQUESTS, JSON.stringify(this.requestsSubject.value))
    localStorage.setItem(this.STORAGE_KEY_SESSIONS, JSON.stringify(this.sessionsSubject.value))
    localStorage.setItem(this.STORAGE_KEY_DEBUG, JSON.stringify(this.debugHistorySubject.value))
  }

  clearConversationData() {
    this.requestsSubject.next([])
    this.sessionsSubject.next([])
    this.debugHistorySubject.next([])
    this.saveConversationData()
  }

  testDebugPersistence() {
    const testMessage: ControlMessage = {
      type: 'conversation_request',
      requestId: 'test_' + Date.now(),
      from: 'user_test',
      to: 'user_target',
      timestamp: new Date()
    }

    this.addToDebugHistory(testMessage)

    setTimeout(() => {
      localStorage.getItem(this.STORAGE_KEY_DEBUG)
    }, 100)
  }
}
