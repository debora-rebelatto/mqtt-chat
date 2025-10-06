import { Component, OnInit, OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { UserListItemComponent } from '../user-list-item/user-list-item.component'
import { ListContainerComponent } from '../../../components/list-container/list-container.component'
import { Subject, takeUntil } from 'rxjs'
import { AppStateService, UserService, ChatService } from '../../../services'
import { AvailableGroup, ChatMessage, ChatType, User } from '../../../models'
import { LucideAngularModule, MessageCircle } from 'lucide-angular'
import { TranslatePipe } from '../../../pipes/translate.pipe'

@Component({
  selector: 'user-list',
  templateUrl: './user-list.component.html',
  standalone: true,
  imports: [
    CommonModule,
    ListContainerComponent,
    UserListItemComponent,
    LucideAngularModule,
    TranslatePipe
  ]
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
    const requestId = this.chatService.requestConversation(user.name)
    alert(`Solicitação de conversa enviada para ${user.name}. ID: ${requestId}`)
  }

  private updateUserChats() {
    console.log('updateUserChats: Atualizando lista de conversas diretas')
    console.log('Usuários conhecidos total:', this.users.length)
    
    // Incluir TODOS os usuários conhecidos (exceto o usuário atual)
    const allKnownUsers = this.users.filter((u) => u.name !== this.appState.username)
    console.log('Usuários conhecidos (exceto atual):', allKnownUsers.length, allKnownUsers.map(u => u.name))

    // Mapear todos os usuários para o formato correto
    const mappedUsers = allKnownUsers.map((user) => {
      const lastMessage = this.getLastUserMessage(user.name)
      return {
        id: user.name,
        name: user.name,
        online: user.online,
        lastSeen: user.online ? null : (lastMessage ? lastMessage.timestamp : user.lastSeen),
        unread: 0
      } as User
    })

    // Encontrar usuários que aparecem apenas nas mensagens (mas não estão na lista de usuários)
    const usersWithMessages = this.getUsersWithMessages()
    const additionalUsers = usersWithMessages
      .filter(username => 
        username !== this.appState.username && 
        !allKnownUsers.some(u => u.name === username)
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

    // Combinar todos os usuários
    const allUsers = [...mappedUsers, ...additionalUsers]

    // Remove duplicatas baseado no ID do usuário
    const uniqueUsers = this.removeDuplicateUsers(allUsers)

    // Ordena as conversas
    this.userChats = this.sortUserChats(uniqueUsers)
    
    console.log('Lista final de conversas diretas:', this.userChats.length)
    console.log('Usuários na lista:', this.userChats.map(u => ({ 
      name: u.name, 
      online: u.online, 
      lastSeen: u.lastSeen 
    })))
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
