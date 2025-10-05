import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'
import { GroupInvitation } from '../../models/group-invitation.model'
import { formatTime } from '../../utils/format-time'
import { TranslatePipe } from '../../pipes/translate.pipe'

@Component({
  selector: 'app-notifications-panel',
  templateUrl: './notifications-panel.component.html',
  standalone: true,
  imports: [CommonModule, TranslatePipe]
})
export class NotificationsPanelComponent {
  @Input() notifications: GroupInvitation[] = []
  @Input() showNotifications = false

  @Output() acceptInvite = new EventEmitter<GroupInvitation>()
  @Output() rejectInvite = new EventEmitter<GroupInvitation>()
  @Output() toggleNotifications = new EventEmitter<void>()

  onAcceptInvite(invitation: GroupInvitation) {
    this.acceptInvite.emit(invitation)
  }

  onRejectInvite(invitation: GroupInvitation) {
    this.rejectInvite.emit(invitation)
  }

  onToggleNotifications() {
    this.toggleNotifications.emit()
  }

  invitationTime(date: Date): string {
    return formatTime(date)
  }
}
