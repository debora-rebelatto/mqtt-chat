import { CommonModule } from '@angular/common'
import { OnInit, OnDestroy, Component } from '@angular/core'
import { TranslateModule } from '@ngx-translate/core'
import { Subject, takeUntil, combineLatest } from 'rxjs'
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
  public NotificationStatus = NotificationStatus

  showNotificationPanel = false
  allGroupInvitations: GroupInvitation[] = []
  allPrivateChatNotifications: PrivateChatNotification[] = []
  filteredPrivateChatNotifications: PrivateChatNotification[] = []
  filteredGroupInvitations: GroupInvitation[] = []
  selectedFilter: 'all' | 'pending' = 'all'

  private statusConfig = new Map([
    [NotificationStatus.pending.id, { color: 'bg-amber-500', label: 'Pendente' }],
    [NotificationStatus.accepted.id, { color: 'bg-emerald-500', label: 'Aceita' }],
    [NotificationStatus.rejected.id, { color: 'bg-rose-500', label: 'Recusada' }]
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
    combineLatest([
      this.invitationService.invitations$,
      this.privateChatRequestService.notifications$,
      this.groupService.groups$
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([invitations, privateNotifications, groups]) => {
        this.allGroupInvitations = invitations.filter((invitation) => {
          const group = groups.find((g: Group) => g.id === invitation.groupId)
          const isLeader = group && group.leader.id === this.appState.user?.id
          return isLeader
        })

        this.allPrivateChatNotifications = privateNotifications.filter(
          (notif) => notif.type === 'request_received'
        )

        this.applyFilter()
      })

    this.invitationService.pendingInvitations$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.applyFilter()
    })
  }

  applyFilter() {
    if (this.selectedFilter === 'all') {
      this.filteredGroupInvitations = this.allGroupInvitations
      this.filteredPrivateChatNotifications = this.allPrivateChatNotifications
    } else {
      this.filteredGroupInvitations = this.allGroupInvitations.filter(
        (inv) => inv.status?.isPending
      )

      this.filteredPrivateChatNotifications = this.allPrivateChatNotifications.filter(
        (notif) => notif.status.isPending
      )
    }

    this.filteredPrivateChatNotifications = [...this.filteredPrivateChatNotifications].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    this.filteredGroupInvitations = [...this.filteredGroupInvitations].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  }

  onFilterChange(filter: 'all' | 'pending') {
    this.selectedFilter = filter
    this.applyFilter()
  }

  get notificationsCount(): number {
    return this.filteredGroupInvitations.length + this.filteredPrivateChatNotifications.length
  }

  get pendingCount(): number {
    console.log('allGroupInvitations:', this.allGroupInvitations)
    console.log('allPrivateChatNotifications:', this.allPrivateChatNotifications)

    const pendingGroupInvitations = this.allGroupInvitations.filter((inv) => {
      console.log(
        'Checking invitation:',
        inv.id,
        'status:',
        inv.status,
        'isPending:',
        inv.status?.isPending
      )
      return inv.status?.isPending ?? false
    }).length

    const pendingPrivateChat = this.allPrivateChatNotifications.filter(
      (notif) => notif.status?.isPending ?? false
    ).length

    console.log('Pending counts - Groups:', pendingGroupInvitations, 'Private:', pendingPrivateChat)

    return pendingGroupInvitations + pendingPrivateChat
  }

  get totalCount(): number {
    return this.allGroupInvitations.length + this.allPrivateChatNotifications.length
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

  canShowActions(notification: PrivateChatNotification | GroupInvitation): boolean {
    if (this.isGroupInvitation(notification)) {
      return (notification as GroupInvitation).status?.isPending ?? true
    } else {
      return (notification as PrivateChatNotification).status.isPending
    }
  }

  private isGroupInvitation(item: any): item is GroupInvitation {
    return item.groupId !== undefined
  }
}
