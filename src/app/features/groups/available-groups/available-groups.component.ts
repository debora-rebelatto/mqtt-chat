import { Component, OnInit, OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { TranslateModule } from '@ngx-translate/core'

import { LucideAngularModule, Search } from 'lucide-angular'
import { Group } from '../../../models'
import { AppStateService, GroupService, InvitationService } from '../../../services'
import { Subject, takeUntil } from 'rxjs'

@Component({
  selector: 'available-groups',
  templateUrl: 'available-groups.component.html',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule]
})
export class AvailableGroupsComponent implements OnInit, OnDestroy {
  readonly Search = Search
  availableGroups: Group[] = []
  private destroy$ = new Subject<void>()
  requestingGroups = new Set<string>()

  constructor(
    private appState: AppStateService,
    private groupService: GroupService,
    private invitationService: InvitationService
  ) {}

  ngOnInit() {
    this.groupService.groups$.pipe(takeUntil(this.destroy$)).subscribe((groups) => {
      this.updateAvailableGroups(groups)
      this.checkAcceptedRequests(groups)
    })
  }

  private checkAcceptedRequests(groups: Group[]) {
    const currentUser = this.appState.user
    if (!currentUser) return

    for (const groupId of this.requestingGroups) {
      const group = groups.find((g) => g.id === groupId)
      if (group && this.isUserMember(group, currentUser.id)) {
        this.requestingGroups.delete(groupId)
      }
    }
  }

  ngOnDestroy() {
    this.destroy$.next()
    this.destroy$.complete()
  }

  private updateAvailableGroups(groups: Group[]) {
    const currentUser = this.appState.user
    if (!currentUser) {
      this.availableGroups = []
      return
    }

    this.availableGroups = groups
      .filter((g) => !this.isUserMember(g, currentUser.id))
      .map((g) => new Group(g.id, g.name, g.leader, g.members))
  }

  private isUserMember(group: Group, userId: string): boolean {
    return group.members.some((member) => member && member.id === userId)
  }

  onRequestJoin(groupId: string) {
    const currentUser = this.appState.user
    if (!currentUser || this.requestingGroups.has(groupId)) {
      return
    }

    const group = this.availableGroups.find((g) => g.id === groupId)
    if (!group) {
      return
    }

    this.requestingGroups.add(groupId)

    const success = this.invitationService.requestJoinGroup(
      group,

    )

    if (!success) {
      this.requestingGroups.delete(groupId)
    }
  }

  isRequesting(groupId: string): boolean {
    return this.requestingGroups.has(groupId)
  }

}
