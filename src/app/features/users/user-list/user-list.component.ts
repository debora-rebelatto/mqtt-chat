import { Component, OnInit, OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { TranslateModule } from '@ngx-translate/core'

import { UserListItemComponent } from '../user-list-item/user-list-item.component'
import { ListContainerComponent } from '../../../components/list-container/list-container.component'
import { Subject, takeUntil } from 'rxjs'
import { AppStateService, UserService, ChatService } from '../../../services'
import { Message, ChatType, Group, User } from '../../../models'
import { LucideAngularModule, MessageCircle } from 'lucide-angular'
@Component({
  selector: 'user-list',
  templateUrl: './user-list.component.html',
  standalone: true,
  imports: [CommonModule, ListContainerComponent, UserListItemComponent, LucideAngularModule, TranslateModule]
})
export class UserListComponent implements OnInit, OnDestroy {
  availableGroups: Group[] = []
  userChats: User[] = []

  private users: User[] = []
  private allMessages: Message[] = []
  private destroy$ = new Subject<void>()
  readonly MessageCircle = MessageCircle

  constructor(
    private appState: AppStateService,
    private userService: UserService,
    private chatService: ChatService
  ) {}

  ngOnInit() {
    this.subscription()
  }

  ngOnDestroy() {
    this.destroy$.next()
    this.destroy$.complete()
  }

  subscription() {
    this.userService.users$.pipe(takeUntil(this.destroy$)).subscribe((users) => {
      this.users = users
      this.updateUserChats()
    })

    this.chatService.messages$.pipe(takeUntil(this.destroy$)).subscribe((messages) => {
      this.allMessages = messages
      this.updateUserChats()
    })
  }

  onUserClick(user: User): void {
    this.appState.selectChat(ChatType.User, user.id, user.name)
    this.chatService.setCurrentChat(ChatType.User, user.id, user.name)
  }

  isSelected(user: User): boolean {
    const selectedChat = this.appState.selectedChat
    return selectedChat?.type === ChatType.User && selectedChat?.id === user.id
  }

  requestConversation(user: User): void {
    this.chatService.requestConversation(user.name)
  }

  private updateUserChats() {
    const currentUser = this.appState.user
    if (!currentUser) return

    const allKnownUsers = this.users.filter((u) => u.id !== currentUser.id)

    const mappedUsers = allKnownUsers.map((user) => {
      const lastMessage = this.getLastUserMessage(user.id)
      return new User(
        user.id,
        user.name,
        user.online,
        user.online ? new Date() : lastMessage ? lastMessage.timestamp : user.lastSeen
      )
    })

    const usersWithMessages = this.getUsersWithMessages()
    const additionalUsers = usersWithMessages
      .filter((userId) => userId !== currentUser.id && !allKnownUsers.some((u) => u.id === userId))
      .map((userId) => {
        const lastMessage = this.getLastUserMessage(userId)
        return new User(userId, userId, false, lastMessage ? lastMessage.timestamp : new Date(0))
      })

    const allUsers = [...mappedUsers, ...additionalUsers]
    const uniqueUsers = this.removeDuplicateUsers(allUsers)

    this.userChats = this.sortUserChats(uniqueUsers)
  }

  private getUsersWithMessages(): string[] {
    const currentUser = this.appState.user
    if (!currentUser) return []

    const users = new Set<string>()

    this.allMessages.forEach((msg) => {
      if (msg.chatType === ChatType.User) {
        if (msg.sender.id !== currentUser.id) {
          users.add(msg.sender.id)
        }
        if (msg.chatId && msg.chatId !== currentUser.id) {
          users.add(msg.chatId)
        }
      }
    })

    return Array.from(users)
  }

  private removeDuplicateUsers(users: User[]): User[] {
    const seen = new Set<string>()
    return users.filter((user) => {
      if (seen.has(user.id)) {
        return false
      }
      seen.add(user.id)
      return true
    })
  }

  private sortUserChats(users: User[]): User[] {
    return users.sort((a, b) => {
      if (a.online && !b.online) return -1
      if (!a.online && b.online) return 1

      const aLastMsg = this.getLastUserMessage(a.id)
      const bLastMsg = this.getLastUserMessage(b.id)

      if (!aLastMsg && !bLastMsg) return a.name.localeCompare(b.name)
      if (!aLastMsg) return 1
      if (!bLastMsg) return -1

      return bLastMsg.timestamp.getTime() - aLastMsg.timestamp.getTime()
    })
  }

  private getLastUserMessage(userId: string): Message | null {
    const currentUser = this.appState.user
    if (!currentUser) return null

    const userMessages = this.allMessages.filter((msg) => {
      if (msg.chatType !== ChatType.User) return false

      const isFromCurrentUserToTarget = msg.sender.id === currentUser.id && msg.chatId === userId
      const isFromTargetToCurrentUser = msg.sender.id === userId && msg.chatId === currentUser.id

      return isFromCurrentUserToTarget || isFromTargetToCurrentUser
    })

    if (userMessages.length === 0) return null

    return userMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]
  }
}
