import { Component, OnInit, OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { Subject, takeUntil } from 'rxjs'
import { ConversationRequestsComponent } from '../conversation-requests/conversation-requests.component'
import { DebugPanelComponent } from '../debug-panel/debug-panel.component'
import { ChatService, UserService, AppStateService } from '../../../services'
import { User } from '../../../models'
import { TranslatePipe } from '../../../pipes/translate.pipe'

@Component({
  selector: 'conversation-demo',
  templateUrl: './conversation-demo.component.html',
  standalone: true,
  imports: [
    CommonModule, 
    ConversationRequestsComponent, 
    DebugPanelComponent,
    TranslatePipe
  ]
})
export class ConversationDemoComponent implements OnInit, OnDestroy {
  users: User[] = []
  private destroy$ = new Subject<void>()

  constructor(
    private chatService: ChatService,
    private userService: UserService,
    private appState: AppStateService
  ) {}

  ngOnInit() {
    this.userService.users$
      .pipe(takeUntil(this.destroy$))
      .subscribe(users => {
        this.users = users.filter(u => 
          u.online && u.name !== this.appState.username
        )
      })
  }

  ngOnDestroy() {
    this.destroy$.next()
    this.destroy$.complete()
  }

  requestConversation(user: User) {
    this.chatService.requestConversation(user.name)
  }
}
