import { Component, OnInit, OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { TranslatePipe } from '../../../pipes/translate.pipe'
import { LucideAngularModule, Search } from 'lucide-angular'
import { Group } from '../../../models'
import { AppStateService, GroupService, InvitationService } from '../../../services'
import { Subject, takeUntil } from 'rxjs'

@Component({
  selector: 'available-groups',
  templateUrl: 'available-groups.component.html',
  standalone: true,
  imports: [CommonModule, TranslatePipe, LucideAngularModule]
})
export class AvailableGroupsComponent implements OnInit, OnDestroy {
  readonly Search = Search
  availableGroups: Group[] = []
  private groups: Group[] = []
  private destroy$ = new Subject<void>()
  requestingGroups = new Set<string>()

  constructor(
    private appState: AppStateService,
    private groupService: GroupService,
    private invitationService: InvitationService
  ) {}

  ngOnInit() {
    this.groupService.groups$.pipe(takeUntil(this.destroy$)).subscribe((groups) => {
      const previousGroups = this.groups
      this.groups = groups
      this.updateAvailableGroups()

      if (previousGroups.length > 0) {
        this.checkForGroupMembership(previousGroups, groups)
      }
    })
  }

  ngOnDestroy() {
    this.destroy$.next()
    this.destroy$.complete()
  }

  private updateAvailableGroups() {
    if (!this.appState.user) return

    this.availableGroups = this.groups
      .filter((g) => !g.members.some((member) => member && member.id === this.appState.user!.id))
      .map((g) => new Group(g.id, g.name, g.leader, g.members))
  }

  onRequestJoin(groupId: string) {
    console.log('Solicitando entrada no grupo:', groupId)
    const group = this.groups.find((g) => g.id === groupId)
    if (!group) {
      return
    }

    if (this.requestingGroups.has(groupId)) {
      return
    }

    if (!this.appState.user) {
      return
    }

    this.requestingGroups.add(groupId)

    const success = this.invitationService.requestJoinGroup(
      group.id,
      group.name,
      this.appState.user,
      group.leader
    )

    if (!success) {
      this.requestingGroups.delete(groupId)
      return
    }
  }

  isRequesting(groupId: string): boolean {
    return this.requestingGroups.has(groupId)
  }

  private checkForGroupMembership(previousGroups: Group[], currentGroups: Group[]) {
    if (!this.appState.user) return
    

    for (const groupId of this.requestingGroups) {
      const previousGroup = previousGroups.find((g) => g.id === groupId)
      const currentGroup = currentGroups.find((g) => g.id === groupId)

      if (previousGroup && currentGroup) {
        const wasNotMember = !previousGroup.members.some((m) => m && m.id === this.appState.user!.id)
        const isNowMember = currentGroup.members.some((m) => m && m.id === this.appState.user!.id)


        if (wasNotMember && isNowMember) {
          this.requestingGroups.delete(groupId)
        }
      }
    }
  }
}
