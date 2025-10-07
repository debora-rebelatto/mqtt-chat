import { Component, OnInit, OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { Subject, takeUntil } from 'rxjs'
import { ChatService, AppStateService } from '../../../services'
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
    private chatService: ChatService,
    private appState: AppStateService
  ) {}

  ngOnInit() {
    this.chatService.requests$
      .pipe(takeUntil(this.destroy$))
      .subscribe((requests: ConversationRequest[]) => {
        this.requests = requests.filter((r: ConversationRequest) => r.to === this.appState.username)
      })
  }

  ngOnDestroy() {
    this.destroy$.next()
    this.destroy$.complete()
  }

  acceptRequest(request: ConversationRequest) {
    this.chatService.acceptConversationRequest(request)
  }

  rejectRequest(request: ConversationRequest) {
    this.chatService.rejectConversationRequest(request)
  }

  getPendingRequests(): ConversationRequest[] {
    return this.requests.filter(r => r.status === 'pending')
  }
}
