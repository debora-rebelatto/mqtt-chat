import { Injectable } from '@angular/core'
import { ChatSession } from '../models/chat-session.model'

@Injectable({ providedIn: 'root' })
export class ChatSessionService {
  private sessions: ChatSession[] = []

  addSession(session: ChatSession) {
    this.sessions.push(session)
  }

  getSessions(): ChatSession[] {
    return this.sessions
  }

  findSessionById(sessionId: string): ChatSession | undefined {
    return this.sessions.find((s) => s.sessionId === sessionId)
  }
}
