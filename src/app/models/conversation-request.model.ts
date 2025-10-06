export interface ConversationRequest {
  id: string
  from: string
  to: string
  timestamp: Date
  status: 'pending' | 'accepted' | 'rejected'
  sessionTopic?: string // Tópico criado quando aceito (formato X_Y_timestamp)
}

export interface ConversationSession {
  id: string
  topic: string
  participants: [string, string]
  createdAt: Date
  active: boolean
}

export interface ControlMessage {
  type: 'conversation_request' | 'conversation_accept' | 'conversation_reject'
  requestId: string
  from: string
  to: string
  sessionTopic?: string
  timestamp: Date
}
