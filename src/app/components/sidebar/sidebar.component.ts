import { Component } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { TranslateModule } from '@ngx-translate/core'

import { LucideAngularModule } from 'lucide-angular'
import { GroupModalComponent } from '../../features/groups/group-modal/group-modal.component'
import { User, AvailableGroup, Group } from '../../models'
import { User, Group } from '../../models'
import { ToggleButtonComponent } from './toggle-button/toggle-button.component'
import { AppStateService, GroupService } from '../../services'
import { GroupListComponent } from '../../features/groups/group-list/group-list.component'
import { UserListComponent } from '../../features/users/user-list/user-list.component'
import { AvailableGroupsComponent } from '../../features/groups/available-groups/available-groups.component'

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
    TranslateModule
  ]
})
export class SidebarComponent {
  activeView = 'chat'
  userChats: User[] = []
  groupChats: Group[] = []
  availableGroups: Group[] = []

  showCreateGroupModal = false
  newGroupName = ''

  users: User[] = []
  private groups: Group[] = []

  constructor(
    private appState: AppStateService,
    private groupService: GroupService
  ) {}

  onViewChange(view: string) {
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
