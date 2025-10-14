import { Component, OnInit, OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { PrivateChatRequestService, UserService } from '../../../services'
import { User } from '../../../models'
import { LucideAngularModule, User as UserIcon } from 'lucide-angular'
import { TranslateModule } from '@ngx-translate/core'

@Component({
  selector: 'available-users',
  templateUrl: './available-users.component.html',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule]
})
export class AvailableUsersComponent implements OnInit, OnDestroy {
  readonly UserIcon = UserIcon

  users: User[] = []
  private sendingRequests = new Set<string>()

  constructor(
    private userService: UserService,
    private chatRequestService: PrivateChatRequestService
  ) {}

  ngOnInit() {
    this.userService.users$.subscribe((users: any) => {
      this.users = users
    })
  }

  canSendRequest(user: User): boolean {
    return (user.online &&
      !this.chatRequestService.isAllowedToChat(user.id) &&
      !this.hasPendingRequest(user.id))!
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
    this.sendingRequests.clear()
  }
}
