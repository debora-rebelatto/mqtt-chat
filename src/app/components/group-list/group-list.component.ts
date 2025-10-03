import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'
import { LucideAngularModule, Search } from 'lucide-angular'
import { Group } from '../../models/group.model'
import { TranslatePipe } from '../../pipes/translate.pipe'
import { MemberCountPipe } from '../../pipes/member-count.pipe'

@Component({
  selector: 'app-group-list',
  templateUrl: './group-list.component.html',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslatePipe, MemberCountPipe]
})
export class GroupListComponent {
  readonly Search = Search
  
  @Input() groups: Group[] = []

  @Output() groupJoined = new EventEmitter<string>()
}
