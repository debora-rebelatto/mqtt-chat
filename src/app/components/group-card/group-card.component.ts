import { Input, Component } from '@angular/core'
import { Group } from '../../models/group.model'
import { TranslatePipe } from "../../pipes/translate.pipe";
import { MemberCountPipe } from "../../pipes/member-count.pipe";

@Component({
  selector: 'group-card',
  templateUrl: 'group-card.component.html',
  imports: [TranslatePipe, MemberCountPipe]
})
export class GroupCardComponent {
  @Input() group!: Group
}
