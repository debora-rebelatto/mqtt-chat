import { Input, Component } from '@angular/core'
import { Group } from '../../../../models/group.model'
import { MemberCountPipe } from '../../../../pipes/member-count.pipe'
import { TranslatePipe } from '../../../../pipes/translate.pipe'

@Component({
  selector: 'group-card',
  templateUrl: 'group-card.component.html',
  imports: [TranslatePipe, MemberCountPipe]
})
export class GroupCardComponent {
  @Input() group!: Group
}
