import { CommonModule } from '@angular/common'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { TranslateModule } from '@ngx-translate/core'
import { LucideAngularModule, MessageCircle, User as UserIcon, UsersRound } from 'lucide-angular'
import { Subject, takeUntil } from 'rxjs'
import { AvailableGroupsComponent } from '../../features/groups/available-groups/available-groups.component'
import { GroupListComponent } from '../../features/groups/group-list/group-list.component'
import { GroupModalComponent } from '../../features/groups/group-modal/group-modal.component'
import { UserListComponent } from '../../features/users/user-list/user-list.component'
import { AppStateService, GroupService, PrivateChatRequestService } from '../../services'
import { ToggleButtonComponent } from './toggle-button/toggle-button.component'
import { AvailableUsersComponent } from '../../features/users/available-users/available-users.component'

export type SidebarView = 'chat' | 'available-users' | 'available-groups'

export interface SidebarViewConfig {
  key: SidebarView
  icon: typeof MessageCircle
  translateKey: string
}

export const SIDEBAR_VIEWS: SidebarViewConfig[] = [
  {
    key: 'chat',
    icon: MessageCircle,
    translateKey: 'CONVERSATIONS'
  },
  {
    key: 'available-users',
    icon: UserIcon,
    translateKey: 'AVAILABLE_USERS'
  },
  {
    key: 'available-groups',
    icon: UsersRound,
    translateKey: 'AVAILABLE_GROUPS'
  }
]

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    GroupModalComponent,
    ToggleButtonComponent,
    GroupListComponent,
    UserListComponent,
    AvailableGroupsComponent,
    TranslateModule,
    AvailableUsersComponent
  ]
})
export class SidebarComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>()
  readonly MessageCircle = MessageCircle
  readonly UserIcon = UserIcon
  readonly UsersRound = UsersRound
  readonly sidebarViews = SIDEBAR_VIEWS

  activeView: SidebarView = 'chat'
  showCreateGroupModal = false
  newGroupName = ''
  pendingRequestCount = 0

  constructor(
    private appState: AppStateService,
    private groupService: GroupService,
    private requestService: PrivateChatRequestService
  ) {}

  ngOnInit() {
    this.requestService.requests$.pipe(takeUntil(this.destroy$)).subscribe((requests) => {
      this.pendingRequestCount = requests.filter((r) => r.status.isPending).length
    })
  }

  ngOnDestroy() {
    this.destroy$.next()
    this.destroy$.complete()
  }

  onViewChange(view: SidebarView): void {
    this.activeView = view
  }

  onModalClose() {
    this.showCreateGroupModal = false
    this.newGroupName = ''
  }

  onModalGroupCreate() {
    if (this.newGroupName.trim()) {
      this.groupService.createGroup(this.newGroupName, this.appState.user!)
      this.showCreateGroupModal = false
      this.newGroupName = ''
    }
  }
}
