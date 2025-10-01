import { Component, Input } from '@angular/core'
import { UserStatus } from '../../models/user-status.model'
import { DateFormatPipe } from '../../pipe/date-format.pipe'

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [DateFormatPipe],
  templateUrl: './user-list.component.html'
})
export class UserListComponent {
  @Input() users: UserStatus[] = []
  @Input() onlineUsersCount: number = 0
}
