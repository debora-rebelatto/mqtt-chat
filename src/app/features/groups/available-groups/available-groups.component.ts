import { Component, OnInit, OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { TranslateModule } from '@ngx-translate/core'

import { LucideAngularModule, Search } from 'lucide-angular'
import { MemberCountPipe } from '../../../pipes/member-count.pipe'
import { AvailableGroup, Group } from '../../../models'
import { AppStateService, GroupService, InvitationService } from '../../../services'
import { Subject, takeUntil } from 'rxjs'

@Component({
  selector: 'available-groups',
  templateUrl: 'available-groups.component.html',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, MemberCountPipe, TranslateModule]
})
export class GroupListItemComponent implements OnInit, OnDestroy {
  readonly Search = Search
  availableGroups: AvailableGroup[] = []
  private groups: Group[] = []
  private destroy$ = new Subject<void>()

  constructor(
    private appState: AppStateService,
    private groupService: GroupService,
    private invitationService: InvitationService
  ) {}

  ngOnInit() {
    this.groupService.groups$.pipe(takeUntil(this.destroy$)).subscribe((groups) => {
      this.groups = groups
      this.updateAvailableGroups()
    })
  }

  ngOnDestroy() {
    this.destroy$.next()
    this.destroy$.complete()
  }

  private updateAvailableGroups() {
    this.availableGroups = this.groups
      .filter((g) => !g.members.includes(this.appState.username))
      .map((g) => ({
        id: g.id,
        name: g.name,
        leader: g.leader,
        members: g.members.length,
        description: `Grupo criado por ${g.leader}`
      }))
  }

  onRequestJoin(groupId: string) {
    const group = this.groups.find((g) => g.id === groupId)
    if (!group) return

    this.invitationService.requestJoinGroup(
      group.id,
      group.name,
      this.appState.username,
      group.leader
    )
  }
}
