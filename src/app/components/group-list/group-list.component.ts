import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'
import { Group } from '../../models/group.model'

@Component({
  selector: 'app-group-list',
  templateUrl: './group-list.component.html',
  standalone: true,
  imports: [CommonModule]
})
export class GroupListComponent {
  @Input() groups: Group[] = []

  @Output() groupJoined = new EventEmitter<string>()
}
