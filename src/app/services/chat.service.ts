import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { ChatMessage } from '../models/chat-message.model'
import { MqttService } from './mqtt.service'
import { ChatType } from '../models/chat-type.component'
import { ConversationRequest, ConversationSession, ControlMessage } from '../models/conversation-request.model'

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

  // Conversation negotiation (conforme especificação do trabalho)
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
    console.log('ChatService constructor iniciado')
    this.loadMessagesFromStorage()
    this.loadPendingMessages()
    this.loadConversationData()
    console.log('ChatService constructor finalizado, mensagens carregadas:', this.messagesSubject.value.length)
  }

  initialize(username: string) {
    this.currentUserId = username
    console.log('ChatService initialize iniciado para usuário:', username)
    console.log('Mensagens no subject antes do initialize:', this.messagesSubject.value.length)
    
    // Subscriptions existentes (mantidas para compatibilidade)
    this.mqttService.subscribe(`meu-chat-mqtt/messages/${username}`, (message) => {
      this.handleUserMessage(message, username)
    })

    this.mqttService.subscribe('meu-chat-mqtt/groups/+/messages', (message) => {
      this.handleGroupMessage(message, username)
    })

    this.mqttService.subscribe(`meu-chat-mqtt/sync/pending/${username}`, (message) => {
      this.handlePendingSync(message, username)
    })

    // NOVO: Tópico de controle conforme especificação (ID_Control)
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

  // ============= CONVERSATION NEGOTIATION (Conforme Especificação) =============
  
  // Configurar subscription para o tópico de controle do usuário atual
  private setupControlSubscription(username: string) {
    const controlTopic = `${username}_Control`
    
    this.mqttService.subscribe(controlTopic, (message) => {
      this.handleControlMessage(message)
    })
  }

  // Processar mensagens recebidas no canal de controle
  private handleControlMessage(message: string) {
    try {
      const controlMsg: ControlMessage = JSON.parse(message)
      
      // Adicionar ao histórico de debug
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

  // Solicitar nova conversa com usuário (conforme especificação)
  requestConversation(targetUserId: string): string {
    const requestId = `req_${Date.now()}_${Math.random().toString(16).substring(2, 8)}`
    
    const request: ConversationRequest = {
      id: requestId,
      from: this.currentUserId,
      to: targetUserId,
      timestamp: new Date(),
      status: 'pending'
    }

    // Adicionar à lista local
    const requests = this.requestsSubject.value
    this.requestsSubject.next([...requests, request])
    this.saveConversationData()

    // Enviar solicitação via tópico de controle do destinatário (ID_Control)
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

  // Aceitar solicitação de conversa
  acceptConversationRequest(request: ConversationRequest) {
    // Criar tópico único para a sessão (formato X_Y_timestamp conforme especificação)
    const timestamp = Date.now()
    const sessionTopic = `${request.to}_${request.from}_${timestamp}`

    // Atualizar status da solicitação
    this.updateRequestStatus(request.id, 'accepted', sessionTopic)

    // Criar nova sessão
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

    // Notificar o solicitante via seu tópico de controle
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

    // Subscrever ao tópico da sessão para mensagens
    this.subscribeToSession(sessionTopic)
  }

  // Rejeitar solicitação de conversa
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
    
    console.log('Mensagem enviada:', {
      from: from,
      to: to,
      chatId: message.chatId,
      content: content
    })

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
    
    console.log('Mensagem processada:', {
      from: data.from,
      to: data.to,
      currentUser: currentUsername,
      fromCurrentUser: data.from === currentUsername,
      chatId: chatMessage.chatId,
      content: data.content
    })

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
      console.log('Adicionando nova mensagem. Total antes:', messages.length, 'Total depois:', updatedMessages.length)
      this.messagesSubject.next(updatedMessages)
      this.saveMessagesToStorage(updatedMessages)
      console.log('Mensagem salva no localStorage')
    } else {
      console.log('Mensagem já existe, não adicionando:', message.id)
    }
  }

  getMessagesForChat(type: 'user' | 'group', chatId: string): ChatMessage[] {
    const allMessages = this.messagesSubject.value
    console.log(`getMessagesForChat chamado para tipo: ${type}, chatId: ${chatId}`)
    console.log('Total de mensagens disponíveis:', allMessages.length)
    
    const messages = allMessages.filter((m) => {
      const typeMatch = m.chatType === type || m.chatType === (type === 'user' ? ChatType.User : ChatType.Group)
      
      if (type === 'user') {
        // Para mensagens de usuário, verificar se é uma conversa entre currentUser e chatId
        const isConversationWithUser = (
          (m.sender === this.currentUserId && m.chatId === chatId) ||
          (m.sender === chatId && m.chatId === this.currentUserId) ||
          m.chatId === chatId
        )
        return typeMatch && isConversationWithUser
      } else {
        // Para grupos, manter lógica original
        return typeMatch && m.chatId === chatId
      }
    })

    console.log(`Mensagens filtradas para ${type}:${chatId}:`, messages.length)
    console.log('Mensagens encontradas:', messages.map(m => ({ 
      id: m.id, 
      content: m.content, 
      sender: m.sender, 
      chatId: m.chatId,
      fromCurrentUser: m.fromCurrentUser
    })))
    
    return messages
  }

  clearMessages() {
    console.log('ATENÇÃO: Limpando todas as mensagens!')
    console.trace('Stack trace para clearMessages:')
    this.messagesSubject.next([])
    this.saveMessagesToStorage([])
  }

  private loadMessagesFromStorage() {
    console.log('Carregando mensagens do localStorage...')
    const stored = localStorage.getItem(this.STORAGE_KEY)
    if (stored) {
      const messages = JSON.parse(stored).map((msg: ChatMessage & { timestamp: string }) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))
      console.log('Mensagens carregadas do localStorage:', messages.length)
      console.log('Detalhes das mensagens carregadas:', messages.map((m: ChatMessage) => ({
        id: m.id,
        sender: m.sender,
        chatId: m.chatId,
        fromCurrentUser: m.fromCurrentUser,
        content: m.content.substring(0, 20) + '...'
      })))
      this.messagesSubject.next(messages)
      console.log('Mensagens definidas no subject, total atual:', this.messagesSubject.value.length)
    } else {
      console.log('Nenhuma mensagem encontrada no localStorage')
    }
  }

  private saveMessagesToStorage(messages: ChatMessage[]) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(messages))
  }

  forceSave() {
    this.saveMessagesToStorage(this.messagesSubject.value)
  }

  forceLoad() {
    console.log('forceLoad() chamado - recarregando mensagens do localStorage')
    console.log('Mensagens antes do forceLoad:', this.messagesSubject.value.length)
    this.loadMessagesFromStorage()
    console.log('Mensagens após forceLoad:', this.messagesSubject.value.length)
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

  // ============= CONVERSATION NEGOTIATION HELPER METHODS =============

  // Processar solicitação recebida
  private handleConversationRequest(controlMsg: ControlMessage) {
    const request: ConversationRequest = {
      id: controlMsg.requestId,
      from: controlMsg.from,
      to: controlMsg.to,
      timestamp: controlMsg.timestamp,
      status: 'pending'
    }

    const requests = this.requestsSubject.value
    const exists = requests.some(r => r.id === request.id)
    
    if (!exists) {
      this.requestsSubject.next([...requests, request])
      this.saveConversationData()
    }
  }

  // Processar aceitação recebida
  private handleConversationAccept(controlMsg: ControlMessage) {
    this.updateRequestStatus(controlMsg.requestId, 'accepted', controlMsg.sessionTopic)
    
    if (controlMsg.sessionTopic) {
      // Subscrever ao tópico da sessão
      this.subscribeToSession(controlMsg.sessionTopic)
    }
  }

  // Processar rejeição recebida
  private handleConversationReject(controlMsg: ControlMessage) {
    this.updateRequestStatus(controlMsg.requestId, 'rejected')
  }

  // Atualizar status de uma solicitação
  private updateRequestStatus(requestId: string, status: 'accepted' | 'rejected', sessionTopic?: string) {
    const requests = this.requestsSubject.value
    const updatedRequests = requests.map(r => 
      r.id === requestId 
        ? { ...r, status, sessionTopic }
        : r
    )
    this.requestsSubject.next(updatedRequests)
    this.saveConversationData()
  }

  // Publicar no tópico de controle de um usuário
  private publishToControlTopic(userId: string, message: ControlMessage) {
    const topic = `${userId}_Control`
    this.mqttService.publish(topic, JSON.stringify(message))
  }

  // Subscrever ao tópico de uma sessão
  private subscribeToSession(sessionTopic: string) {
    this.mqttService.subscribe(sessionTopic, (message) => {
      // Processar mensagens da sessão como mensagens normais
      this.handleSessionMessage(message, sessionTopic)
    })
  }

  // Processar mensagens de sessão
  private handleSessionMessage(message: string, sessionTopic: string) {
    try {
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
    } catch (error) {
      console.error('Erro ao processar mensagem de sessão:', error)
    }
  }

  // Adicionar ao histórico de debug
  private addToDebugHistory(message: ControlMessage) {
    console.log('Adicionando ao histórico de debug:', message)
    const history = this.debugHistorySubject.value
    const newHistory = [...history, message]
    this.debugHistorySubject.next(newHistory)
    console.log('Histórico atualizado, total de itens:', newHistory.length)
    this.saveConversationData()
    console.log('Dados salvos no localStorage')
  }

  // Obter solicitações pendentes
  getPendingRequests(): ConversationRequest[] {
    return this.requestsSubject.value.filter(r => r.status === 'pending')
  }

  // Obter sessões ativas
  getActiveSessions(): ConversationSession[] {
    return this.sessionsSubject.value.filter(s => s.active)
  }

  // Carregar dados de conversa do localStorage
  private loadConversationData() {
    try {
      console.log('Carregando dados de conversa do localStorage...')
      
      const requests = localStorage.getItem(this.STORAGE_KEY_REQUESTS)
      if (requests) {
        const parsedRequests = JSON.parse(requests).map((r: ConversationRequest & { timestamp: string }) => ({
          ...r,
          timestamp: new Date(r.timestamp)
        }))
        this.requestsSubject.next(parsedRequests)
        console.log('Solicitações carregadas:', parsedRequests.length)
      }

      const sessions = localStorage.getItem(this.STORAGE_KEY_SESSIONS)
      if (sessions) {
        const parsedSessions = JSON.parse(sessions).map((s: ConversationSession & { createdAt: string }) => ({
          ...s,
          createdAt: new Date(s.createdAt)
        }))
        this.sessionsSubject.next(parsedSessions)
        console.log('Sessões carregadas:', parsedSessions.length)
      }

      const debug = localStorage.getItem(this.STORAGE_KEY_DEBUG)
      if (debug) {
        const parsedDebug = JSON.parse(debug).map((d: ControlMessage & { timestamp: string }) => ({
          ...d,
          timestamp: new Date(d.timestamp)
        }))
        this.debugHistorySubject.next(parsedDebug)
        console.log('Histórico de debug carregado:', parsedDebug.length, 'itens')
      } else {
        console.log('Nenhum histórico de debug encontrado no localStorage')
      }
    } catch (error) {
      console.error('Erro ao carregar dados de conversa do localStorage:', error)
    }
  }

  // Salvar dados de conversa no localStorage
  private saveConversationData() {
    localStorage.setItem(this.STORAGE_KEY_REQUESTS, JSON.stringify(this.requestsSubject.value))
    localStorage.setItem(this.STORAGE_KEY_SESSIONS, JSON.stringify(this.sessionsSubject.value))
    localStorage.setItem(this.STORAGE_KEY_DEBUG, JSON.stringify(this.debugHistorySubject.value))
  }

  // Limpar dados de conversa
  clearConversationData() {
    this.requestsSubject.next([])
    this.sessionsSubject.next([])
    this.debugHistorySubject.next([])
    this.saveConversationData()
  }

  // Método para testar a persistência (temporário para debug)
  testDebugPersistence() {
    const testMessage: ControlMessage = {
      type: 'conversation_request',
      requestId: 'test_' + Date.now(),
      from: 'user_test',
      to: 'user_target',
      timestamp: new Date()
    }
    
    console.log('Testando persistência do histórico...')
    this.addToDebugHistory(testMessage)
    
    // Verificar se foi salvo
    setTimeout(() => {
      const saved = localStorage.getItem(this.STORAGE_KEY_DEBUG)
      console.log('Dados salvos no localStorage:', saved ? JSON.parse(saved).length + ' itens' : 'nenhum')
    }, 100)
  }
}
