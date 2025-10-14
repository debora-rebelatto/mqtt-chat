import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { TranslateModule } from '@ngx-translate/core'
import { GroupInvitation, PrivateChatRequest } from '../../models'
import { InvitationService, PrivateChatRequestService } from '../../services'
import { ListContainerComponent } from '../notification-item/notification-item.component'
import { DateFormatPipe } from '../../pipes/date-format.pipe'

export type NotificationItem =
  | { type: 'group-invitation'; data: GroupInvitation }
  | { type: 'private-chat-request'; data: PrivateChatRequest }

@Component({
  selector: 'notifications-panel',
  templateUrl: './notifications-panel.component.html',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListContainerComponent, DateFormatPipe]
})
export class NotificationsPanelComponent implements OnInit {
  @Input() groupNotifications: GroupInvitation[] = []
  @Input() chatNotifications: PrivateChatRequest[] = []
  @Output() togglePanel = new EventEmitter<void>()

  showNotificationPanel = false
  chatRequests: PrivateChatRequest[] = []

  constructor(
    private invitationService: InvitationService,
    private privateChatRequestService: PrivateChatRequestService
  ) {}

  ngOnInit() {
    this.privateChatRequestService.requests$.subscribe((requests) => {
      this.chatRequests = requests
    })
  }

  get notificationsCount(): number {
    return this.groupNotifications.length + this.chatNotifications.length
  }

  onToggleNotifications(): void {
    this.showNotificationPanel = !this.showNotificationPanel
  }

  onAcceptInvite(invitation: GroupInvitation) {
    this.invitationService.acceptInvitation(invitation)
  }

  onRejectInvite(invitation: GroupInvitation) {
    this.invitationService.rejectInvitation(invitation)
  }

  onAcceptChatRequest(request: PrivateChatRequest) {
    this.privateChatRequestService.acceptRequest(request)
  }

  onRejectChatRequest(request: PrivateChatRequest) {
    this.privateChatRequestService.rejectRequest(request)
  }
}
