import { Component, OnInit, OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { Subject, takeUntil } from 'rxjs'
import { ChatService } from '../../../services'
import { ControlMessage, ConversationRequest, ConversationSession } from '../../../models/conversation-request.model'
import { TranslatePipe } from '../../../pipes/translate.pipe'

@Component({
  selector: 'debug-panel',
  templateUrl: './debug-panel.component.html',
  standalone: true,
  imports: [CommonModule, TranslatePipe]
})
export class DebugPanelComponent implements OnInit, OnDestroy {
  debugHistory: ControlMessage[] = []
  requests: ConversationRequest[] = []
  sessions: ConversationSession[] = []
  showDebug = false
  private destroy$ = new Subject<void>()

  constructor(private chatService: ChatService) {}

  ngOnInit() {
    this.chatService.debugHistory$
      .pipe(takeUntil(this.destroy$))
      .subscribe((history: ControlMessage[]) => {
        this.debugHistory = history.sort((a: ControlMessage, b: ControlMessage) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
      })

    this.chatService.requests$
      .pipe(takeUntil(this.destroy$))
      .subscribe((requests: ConversationRequest[]) => {
        this.requests = requests
      })

    this.chatService.sessions$
      .pipe(takeUntil(this.destroy$))
      .subscribe((sessions: ConversationSession[]) => {
        this.sessions = sessions
      })
  }

  ngOnDestroy() {
    this.destroy$.next()
    this.destroy$.complete()
  }

  toggleDebug() {
    this.showDebug = !this.showDebug
  }

  getMessageTypeLabel(type: string): string {
    switch (type) {
      case 'conversation_request': return 'Solicitação'
      case 'conversation_accept': return 'Aceitação'
      case 'conversation_reject': return 'Rejeição'
      default: return type
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'pending': return 'Pendente'
      case 'accepted': return 'Aceito'
      case 'rejected': return 'Rejeitado'
      default: return status
    }
  }

  clearDebugHistory() {
    this.chatService.clearConversationData()
  }

  // Método temporário para testar persistência
  testPersistence() {
    (this.chatService as any).testDebugPersistence()
  }
}
