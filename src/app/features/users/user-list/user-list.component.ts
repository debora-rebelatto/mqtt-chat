import { Component, OnInit, OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { TranslateModule } from '@ngx-translate/core'

import { UserListItemComponent } from '../user-list-item/user-list-item.component'
import { ListContainerComponent } from '../../../components/list-container/list-container.component'
import { Subject, takeUntil } from 'rxjs'
import { AppStateService, UserService, ChatService } from '../../../services'
import { AvailableGroup, ChatMessage, ChatType, User } from '../../../models'
import { LucideAngularModule, MessageCircle } from 'lucide-angular'
@Component({
  selector: 'user-list',
  templateUrl: './user-list.component.html',
  standalone: true,
  imports: [CommonModule, ListContainerComponent, UserListItemComponent, LucideAngularModule, TranslateModule]
})
export class UserListComponent implements OnInit, OnDestroy {
  availableGroups: AvailableGroup[] = []
  userChats: User[] = []

  private users: User[] = []
  private allMessages: ChatMessage[] = []
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
    this.appState.selectChat(ChatType.User, user.name, user.name)
    this.chatService.setCurrentChat(ChatType.User, user.name)
  }

  isSelected(user: User): boolean {
    const selectedChat = this.appState.selectedChat
    return selectedChat?.type === ChatType.User && selectedChat?.id === user.name
  }

  requestConversation(user: User): void {
    this.chatService.requestConversation(user.name)
  }

  private updateUserChats() {
    const allKnownUsers = this.users.filter((u) => u.name !== this.appState.username)

    const mappedUsers = allKnownUsers.map((user) => {
      const lastMessage = this.getLastUserMessage(user.name)
      return {
        id: user.name,
        name: user.name,
        online: user.online,
        lastSeen: user.online ? null : lastMessage ? lastMessage.timestamp : user.lastSeen,
        unread: 0
      } as User
    })

    const usersWithMessages = this.getUsersWithMessages()
    const additionalUsers = usersWithMessages
      .filter(
        (username) =>
          username !== this.appState.username && !allKnownUsers.some((u) => u.name === username)
      )
      .map((username) => {
        const lastMessage = this.getLastUserMessage(username)
        return {
          id: username,
          name: username,
          online: false,
          lastSeen: lastMessage ? lastMessage.timestamp : new Date(0),
          unread: 0
        } as User
      })

    const allUsers = [...mappedUsers, ...additionalUsers]

    const uniqueUsers = this.removeDuplicateUsers(allUsers)

    this.userChats = this.sortUserChats(uniqueUsers)
  }

  private getUsersWithMessages(): string[] {
    const users = new Set<string>()

    this.allMessages.forEach((msg) => {
      if (msg.chatType === 'user') {
        if (msg.fromCurrentUser) {
          users.add(msg.chatId!)
        } else {
          users.add(msg.sender)
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

      const aLastMsg = this.getLastUserMessage(a.name)
      const bLastMsg = this.getLastUserMessage(b.name)

      if (!aLastMsg && !bLastMsg) return a.name.localeCompare(b.name)
      if (!aLastMsg) return 1
      if (!bLastMsg) return -1

      return bLastMsg.timestamp.getTime() - aLastMsg.timestamp.getTime()
    })
  }

  private getLastUserMessage(username: string): ChatMessage | null {
    const userMessages = this.allMessages.filter(
      (msg) => msg.chatType === 'user' && (msg.chatId === username || msg.sender === username)
    )

    if (userMessages.length === 0) return null

    return userMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]
  }
}
