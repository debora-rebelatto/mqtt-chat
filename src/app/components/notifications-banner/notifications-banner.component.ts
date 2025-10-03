import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'
import { GroupInvitation } from '../../models/group-invitation.model'

@Component({
  selector: 'app-notifications-banner',
  templateUrl: './notifications-banner.component.html',
  standalone: true,
  imports: [CommonModule]
})
export class NotificationsBannerComponent {
  @Input() notifications: GroupInvitation[] = []
  @Input() showNotifications = false

  @Output() acceptInvite = new EventEmitter<GroupInvitation>()
  @Output() rejectInvite = new EventEmitter<GroupInvitation>()

  formatInvitationTime(date: Date): string {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)

    if (minutes < 1) return 'agora'
    if (minutes < 60) return `${minutes} min atrás`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h atrás`

    const days = Math.floor(hours / 24)
    return `${days}d atrás`
  }

  onAcceptInvite(invitation: GroupInvitation) {
    this.acceptInvite.emit(invitation)
  }

  onRejectInvite(invitation: GroupInvitation) {
    this.rejectInvite.emit(invitation)
  }
}
