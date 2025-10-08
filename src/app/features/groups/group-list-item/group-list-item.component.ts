import { Input, Component, EventEmitter, Output } from '@angular/core'
import { TranslateModule } from '@ngx-translate/core'

import { Group } from '../../../models/group.model'
import { MemberCountPipe } from '../../../pipes/member-count.pipe'
import { BadgeComponent } from '../badge/badge.component'
import { AppStateService } from '../../../services'

@Component({
  selector: 'group-list-item',
  templateUrl: 'group-list-item.component.html',
  imports: [MemberCountPipe, BadgeComponent, TranslateModule]
})
export class GroupListItemComponent {
  @Input() group!: Group
  @Output() groupClick = new EventEmitter<Group>()

  constructor(private appService: AppStateService) {}

  isLeader(leader: string): boolean {
    return this.appService.username === leader ? true : false
  }

  onGroupClick(): void {
    this.groupClick.emit(this.group)
  }
}
