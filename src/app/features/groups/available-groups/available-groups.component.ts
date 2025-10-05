import { Component } from '@angular/core'
import { TranslatePipe } from '../../../pipes/translate.pipe'
import { LucideAngularModule, Search } from 'lucide-angular'
import { MemberCountPipe } from '../../../pipes/member-count.pipe'
import { AvailableGroup, Group } from '../../../models'
import { AppStateService, GroupService } from '../../../services'

@Component({
  selector: 'available-groups',
  templateUrl: 'available-groups.component.html',
  imports: [TranslatePipe, LucideAngularModule, MemberCountPipe]
})
export class GroupListItemComponent {
  readonly Search = Search
  availableGroups: AvailableGroup[] = []
  private groups: Group[] = []

  constructor(
    private appState: AppStateService,
    private groupService: GroupService,
  ) {}

  onJoinGroup(groupId: string) {
    const group = this.groups.find((g) => g.id === groupId)
    if (!group) return

    group.members.push(this.appState.username)
    this.groupService.updateGroup(group)
  }
}
