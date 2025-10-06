import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { MqttService } from './mqtt.service'
import { ConversationRequest, ConversationSession, ControlMessage } from '../models/conversation-request.model'

@Injectable({
  providedIn: 'root'
})
export class ConversationService {
  private requestsSubject = new BehaviorSubject<ConversationRequest[]>([])
  private sessionsSubject = new BehaviorSubject<ConversationSession[]>([])
  private debugHistorySubject = new BehaviorSubject<ControlMessage[]>([])

  public requests$ = this.requestsSubject.asObservable()
  public sessions$ = this.sessionsSubject.asObservable()
  public debugHistory$ = this.debugHistorySubject.asObservable()

  private currentUserId: string = ''
  private readonly STORAGE_KEY_REQUESTS = 'mqtt-chat-conversation-requests'
  private readonly STORAGE_KEY_SESSIONS = 'mqtt-chat-conversation-sessions'
  private readonly STORAGE_KEY_DEBUG = 'mqtt-chat-debug-history'

  constructor(private mqttService: MqttService) {
    this.loadFromStorage()
  }

  initialize(userId: string) {
    this.currentUserId = userId
    this.setupControlSubscription()
  }

  // Configurar subscription para o tópico de controle do usuário atual
  private setupControlSubscription() {
    if (!this.currentUserId) return

    const controlTopic = `${this.currentUserId}_Control`
    
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

  // Solicitar nova conversa com usuário
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
    this.saveRequestsToStorage()

    // Enviar solicitação via tópico de controle do destinatário
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
    // Criar tópico único para a sessão (formato X_Y_timestamp)
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
    this.saveSessionsToStorage()

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

    // Subscrever ao tópico da sessão
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
      this.saveRequestsToStorage()
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
    this.saveRequestsToStorage()
  }

  // Publicar no tópico de controle de um usuário
  private publishToControlTopic(userId: string, message: ControlMessage) {
    const topic = `${userId}_Control`
    this.mqttService.publish(topic, JSON.stringify(message))
  }

  // Subscrever ao tópico de uma sessão
  private subscribeToSession(sessionTopic: string) {
    this.mqttService.subscribe(sessionTopic, (message) => {
      // Aqui você pode processar mensagens da sessão
      console.log(`Mensagem na sessão ${sessionTopic}:`, message)
    })
  }

  // Adicionar ao histórico de debug
  private addToDebugHistory(message: ControlMessage) {
    const history = this.debugHistorySubject.value
    this.debugHistorySubject.next([...history, message])
    this.saveDebugToStorage()
  }

  // Obter solicitações pendentes
  getPendingRequests(): ConversationRequest[] {
    return this.requestsSubject.value.filter(r => r.status === 'pending')
  }

  // Obter sessões ativas
  getActiveSessions(): ConversationSession[] {
    return this.sessionsSubject.value.filter(s => s.active)
  }

  // Limpar dados
  clearData() {
    this.requestsSubject.next([])
    this.sessionsSubject.next([])
    this.debugHistorySubject.next([])
    this.saveRequestsToStorage()
    this.saveSessionsToStorage()
    this.saveDebugToStorage()
  }

  // Métodos de persistência
  private loadFromStorage() {
    try {
      const requests = localStorage.getItem(this.STORAGE_KEY_REQUESTS)
      if (requests) {
        const parsedRequests = JSON.parse(requests).map((r: ConversationRequest & { timestamp: string }) => ({
          ...r,
          timestamp: new Date(r.timestamp)
        }))
        this.requestsSubject.next(parsedRequests)
      }

      const sessions = localStorage.getItem(this.STORAGE_KEY_SESSIONS)
      if (sessions) {
        const parsedSessions = JSON.parse(sessions).map((s: ConversationSession & { createdAt: string }) => ({
          ...s,
          createdAt: new Date(s.createdAt)
        }))
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
    } catch (error) {
      console.error('Erro ao carregar dados do localStorage:', error)
    }
  }

  private saveRequestsToStorage() {
    localStorage.setItem(this.STORAGE_KEY_REQUESTS, JSON.stringify(this.requestsSubject.value))
  }

  private saveSessionsToStorage() {
    localStorage.setItem(this.STORAGE_KEY_SESSIONS, JSON.stringify(this.sessionsSubject.value))
  }

  private saveDebugToStorage() {
    localStorage.setItem(this.STORAGE_KEY_DEBUG, JSON.stringify(this.debugHistorySubject.value))
  }
}
