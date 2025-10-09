import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'
import { TranslateModule } from '@ngx-translate/core'

import { GroupInvitation } from '../../models/group-invitation.model'
import { DateFormatPipe } from '../../pipes/date-format.pipe'

@Component({
  selector: 'app-notifications-panel',
  templateUrl: './notifications-panel.component.html',
  standalone: true,
  imports: [CommonModule, DateFormatPipe, TranslateModule]
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
}
