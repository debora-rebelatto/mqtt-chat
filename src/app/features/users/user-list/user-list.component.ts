import { Component, OnInit, OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { TranslateModule } from '@ngx-translate/core'

import { UserListItemComponent } from '../user-list-item/user-list-item.component'
import { ListContainerComponent } from '../../../components/list-container/list-container.component'
import { Subject, takeUntil } from 'rxjs'
import { AppStateService, UserService, ChatService } from '../../../services'
import { ChatType, User } from '../../../models'
import { LucideAngularModule, MessageCircle } from 'lucide-angular'
@Component({
  selector: 'user-list',
  templateUrl: './user-list.component.html',
  standalone: true,
  imports: [
    CommonModule,
    ListContainerComponent,
    UserListItemComponent,
    LucideAngularModule,
    TranslateModule
  ]
})
export class UserListComponent implements OnInit, OnDestroy {
  userChats: User[] = []
  private destroy$ = new Subject<void>()
  readonly MessageCircle = MessageCircle

  constructor(
    private appState: AppStateService,
    private userService: UserService,
    private chatService: ChatService
  ) {}

  ngOnInit() {
    this.setupSubscriptions()
  }

  ngOnDestroy() {
    this.destroy$.next()
    this.destroy$.complete()
  }

  private setupSubscriptions() {
    this.userService.users$.pipe(takeUntil(this.destroy$)).subscribe((userChats) => {
      this.userChats = userChats
    })
  }

  onUserClick(user: User): void {
    this.appState.selectChat(ChatType.User, user.id, user.name)
  }

  isSelected(user: User): boolean {
    const selectedChat = this.appState.selectedChat
    return selectedChat?.type === ChatType.User && selectedChat?.id === user.id
  }
}
