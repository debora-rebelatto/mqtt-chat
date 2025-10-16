import { Component, OnInit, OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { AppStateService, PrivateChatRequestService, UserService } from '../../../services'
import { User } from '../../../models'
import { LucideAngularModule, User as UserIcon } from 'lucide-angular'
import { TranslateModule } from '@ngx-translate/core'
import { Subject, takeUntil, combineLatest } from 'rxjs'

@Component({
  selector: 'available-users',
  templateUrl: './available-users.component.html',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule]
})
export class AvailableUsersComponent implements OnInit, OnDestroy {
  readonly UserIcon = UserIcon

  availableUsers: User[] = []
  private sendingRequests = new Set<string>()
  private destroy$ = new Subject<void>()

  constructor(
    private appState: AppStateService,
    private userService: UserService,
    private chatRequestService: PrivateChatRequestService
  ) {}

  ngOnInit() {
    combineLatest([
      this.userService.users$,
      this.chatRequestService.allowedChats$,
      this.chatRequestService.requests$,
      this.chatRequestService.sentRequests$
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([users, allowedChats, requests, sentRequests]) => {
        this.availableUsers = users.filter((user) => {
          if (user.id === this.appState.user?.id) {
            return false
          }

          if (allowedChats.has(user.id)) {
            return false
          }

          const hasPendingReceived = requests.some(
            (req) => req.relatedUser.id === user.id && req.status.isPending
          )
          const hasPendingSent = sentRequests.some(
            (req) => req.relatedUser.id === user.id && req.status.isPending
          )

          return !hasPendingReceived && !hasPendingSent
        })
      })
  }

  canSendRequest(user: User): boolean {
    return this.chatRequestService.canSendRequestTo(user.id)
  }

  hasPendingRequest(userId: string): boolean {
    return this.chatRequestService.hasPendingRequest(userId)
  }

  isSendingRequest(userId: string): boolean {
    return this.sendingRequests.has(userId)
  }

  sendChatRequest(user: User) {
    this.sendingRequests.add(user.id)

    const success = this.chatRequestService.sendChatRequest(user)

    if (!success) {
      this.sendingRequests.delete(user.id)
    }
  }

  ngOnDestroy() {
    this.destroy$.next()
    this.destroy$.complete()
    this.sendingRequests.clear()
  }
}
