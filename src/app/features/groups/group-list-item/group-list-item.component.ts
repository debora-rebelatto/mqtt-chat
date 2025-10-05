import { Input, Component } from '@angular/core'
import { Group } from '../../../models/group.model'
import { MemberCountPipe } from '../../../pipes/member-count.pipe'
import { TranslatePipe } from '../../../pipes/translate.pipe'
import { BadgeComponent } from '../badge/badge.component'
import { AppStateService } from '../../../services'

@Component({
  selector: 'group-list-item',
  templateUrl: 'group-list-item.component.html',
  imports: [TranslatePipe, MemberCountPipe, BadgeComponent]
})
export class GroupListItemComponent {
  @Input() group!: Group

  constructor(private appService: AppStateService) {}

  isLeader(leader: string): boolean {
    return this.appService.username === leader ? true : false
  }
}
