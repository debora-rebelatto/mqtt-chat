import { Component, OnInit, OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { Subject, takeUntil } from 'rxjs'
import { ConversationService, AppStateService } from '../../../services'
import { ConversationRequest } from '../../../models/conversation-request.model'
import { TranslatePipe } from '../../../pipes/translate.pipe'

@Component({
  selector: 'conversation-requests',
  templateUrl: './conversation-requests.component.html',
  standalone: true,
  imports: [CommonModule, TranslatePipe]
})
export class ConversationRequestsComponent implements OnInit, OnDestroy {
  requests: ConversationRequest[] = []
  private destroy$ = new Subject<void>()

  constructor(
    private conversationService: ConversationService,
    private appState: AppStateService
  ) {}

  ngOnInit() {
    this.conversationService.requests$
      .pipe(takeUntil(this.destroy$))
      .subscribe(requests => {
        // Mostrar apenas solicitações recebidas pelo usuário atual
        this.requests = requests.filter(r => r.to === this.appState.username)
      })
  }

  ngOnDestroy() {
    this.destroy$.next()
    this.destroy$.complete()
  }

  acceptRequest(request: ConversationRequest) {
    this.conversationService.acceptConversationRequest(request)
  }

  rejectRequest(request: ConversationRequest) {
    this.conversationService.rejectConversationRequest(request)
  }

  getPendingRequests(): ConversationRequest[] {
    return this.requests.filter(r => r.status === 'pending')
  }
}
