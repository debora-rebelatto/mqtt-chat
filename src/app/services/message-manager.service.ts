import { Injectable } from '@angular/core'
import { BehaviorSubject, Observable } from 'rxjs'

@Injectable({
  providedIn: 'root'
})
export class MessageManagerService {
  private messagesSubject = new BehaviorSubject<string[]>([])
  private historyLoadedSubject = new BehaviorSubject<boolean>(false)

  messages$: Observable<string[]> = this.messagesSubject.asObservable()
  historyLoaded$: Observable<boolean> = this.historyLoadedSubject.asObservable()

  get messages(): string[] {
    return this.messagesSubject.value
  }

  get historyLoaded(): boolean {
    return this.historyLoadedSubject.value
  }

  addMessage(message: string) {
    if (this.messages.includes(message)) return

    const updated = [...this.messages, message]
    this.messagesSubject.next(updated)
  }

  loadHistory(messages: string[]) {
    this.messagesSubject.next(messages)
    this.historyLoadedSubject.next(true)
  }

  clearMessages() {
    this.messagesSubject.next([])
    this.historyLoadedSubject.next(false)
  }

  getRecentMessages(count: number = 50): string[] {
    return this.messages.slice(-count)
  }

  formatUserMessage(username: string, message: string): string {
    return `${username}: ${message}`
  }

  formatSystemMessage(username: string, action: string): string {
    return `💬 ${username} ${action}`
  }
}
