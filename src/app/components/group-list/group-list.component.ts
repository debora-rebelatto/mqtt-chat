import { Component, Input, Output, EventEmitter } from '@angular/core'
import { Group } from '../../models/group.model'

@Component({
  selector: 'app-group-list',
  standalone: true,
  templateUrl: './group-list.component.html'
})
export class GroupListComponent {
  @Input() groups: Group[] = []
  @Input() currentUsername: string = ''
  @Output() createGroup = new EventEmitter<void>()
}
