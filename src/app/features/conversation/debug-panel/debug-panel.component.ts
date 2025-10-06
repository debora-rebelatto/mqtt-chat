import { Component, OnInit, OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { Subject, takeUntil } from 'rxjs'
import { ConversationService } from '../../../services'
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

  constructor(private conversationService: ConversationService) {}

  ngOnInit() {
    this.conversationService.debugHistory$
      .pipe(takeUntil(this.destroy$))
      .subscribe(history => {
        this.debugHistory = history.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
      })

    this.conversationService.requests$
      .pipe(takeUntil(this.destroy$))
      .subscribe(requests => {
        this.requests = requests
      })

    this.conversationService.sessions$
      .pipe(takeUntil(this.destroy$))
      .subscribe(sessions => {
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
    this.conversationService.clearData()
  }
}
