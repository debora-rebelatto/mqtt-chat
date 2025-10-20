import { CommonModule } from '@angular/common'
import { OnInit, OnDestroy, Component } from '@angular/core'
import { TranslateModule } from '@ngx-translate/core'
import { Subject, takeUntil } from 'rxjs'
import { GroupInvitation, PrivateChatNotification, NotificationStatus, Group } from '../../models'
import { DateFormatPipe } from '../../pipes/date-format.pipe'
import {
  InvitationService,
  PrivateChatRequestService,
  GroupService,
  AppStateService
} from '../../services'
import { NotificationItemComponent } from '../notification-item/notification-item.component'
import { FilterButtonComponent } from '../filter-button/filter-button.component'

@Component({
  selector: 'notifications-panel',
  templateUrl: './notifications-panel.component.html',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    NotificationItemComponent,
    DateFormatPipe,
    FilterButtonComponent
  ]
})
export class NotificationsPanelComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>()

  showNotificationPanel = false
  showHistory = false
  groupNotifications: GroupInvitation[] = []
  allNotifications: PrivateChatNotification[] = []
  privateChatNotifications: PrivateChatNotification[] = []
  selectedFilter: 'all' | 'pending' = 'all'

  private statusConfig = new Map([
    [NotificationStatus.pending.id, { color: 'bg-amber-500', label: 'Pendente' }],
    [NotificationStatus.accepted.id, { color: 'bg-emerald-500', label: 'Aceita' }],
    [NotificationStatus.rejected.id, { color: 'bg-rose-500', label: 'Recusada' }],
  ])

  constructor(
    private invitationService: InvitationService,
    private privateChatRequestService: PrivateChatRequestService,
    private groupService: GroupService,
    private appState: AppStateService
  ) {}

  ngOnInit() {
    this.setupSubscriptions()
  }

  ngOnDestroy() {
    this.destroy$.next()
    this.destroy$.complete()
  }

  private setupSubscriptions() {
    this.invitationService.invitations$.pipe(takeUntil(this.destroy$)).subscribe((invitations) => {
      this.groupNotifications = invitations.filter((invitation) => {
        const group = this.groupService.getGroups().find((g: Group) => g.id === invitation.groupId)
        const isLeader = group && group.leader.id === this.appState.user?.id
        return isLeader
      })
    })

    this.privateChatRequestService.notifications$
      .pipe(takeUntil(this.destroy$))
      .subscribe((notifications) => {
        this.allNotifications = [...notifications].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
        this.applyFilter()
      })
  }

  applyFilter() {
    if (this.selectedFilter === 'all') {
      this.privateChatNotifications = this.allNotifications.filter(
        (notif) => notif.type === 'request_received'
      )
    } else {
      this.privateChatNotifications = this.allNotifications.filter(
        (notif) => notif.type === 'request_received' && notif.status.isPending
      )
    }
  }

  onFilterChange(filter: 'all' | 'pending') {
    this.selectedFilter = filter
    this.applyFilter()
  }

  get notificationsCount(): number {
    return this.groupNotifications.length + this.privateChatNotifications.length
  }

  getCountByStatus(status: NotificationStatus): number {
    return this.allNotifications.filter((notif) => {
      console.log(notif, this.appState.user?.id)
      return notif.status === status && notif.relatedUser.id == this.appState.user!.id
    }).length
  }

  get pendingCount(): number {
    return this.privateChatRequestService.getPendingReceivedCount()
  }

  onToggleNotifications(): void {
    this.showNotificationPanel = !this.showNotificationPanel
    if (this.showNotificationPanel) {
      this.showHistory = false
    }
  }

  onAcceptInvite(invitation: GroupInvitation) {
    this.invitationService.acceptInvitation(invitation)
  }

  onRejectInvite(invitation: GroupInvitation) {
    this.invitationService.rejectInvitation(invitation)
  }

  onAcceptChatRequest(notification: PrivateChatNotification) {
    this.privateChatRequestService.acceptRequest(notification.id)
  }

  onRejectChatRequest(notification: PrivateChatNotification) {
    this.privateChatRequestService.rejectRequest(notification.id)
  }

  getStatusColor(status: NotificationStatus): string {
    return this.statusConfig.get(status.id)?.color || 'bg-gray-600'
  }

  getStatusLabel(status: NotificationStatus): string {
    return this.statusConfig.get(status.id)?.label || status.id
  }
}
