import { Component, OnInit, OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { Subject, takeUntil } from 'rxjs'
import { LucideAngularModule, MessageCircle, Users, Search } from 'lucide-angular'
import { GroupModalComponent } from '../../features/groups/group-modal/group-modal.component'
import { User, GroupChat, AvailableGroup, Group, ChatMessage } from '../../models'
import { MemberCountPipe } from '../../pipes/member-count.pipe'
import { TranslatePipe } from '../../pipes/translate.pipe'
import { ToggleButtonComponent } from './toggle-button/toggle-button.component'
import { AppStateService, UserService, GroupService, ChatService } from '../../services'

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    TranslatePipe,
    MemberCountPipe,
    GroupModalComponent,
    ToggleButtonComponent
  ]
})
export class SidebarComponent implements OnInit, OnDestroy {
  readonly MessageCircle = MessageCircle
  readonly Users = Users
  readonly Search = Search

  private destroy$ = new Subject<void>()

  activeView = 'chat'
  userChats: User[] = []
  groupChats: GroupChat[] = []
  availableGroups: AvailableGroup[] = []

  showCreateGroupModal = false
  newGroupName = ''

  private users: User[] = []
  private groups: Group[] = []
  private allMessages: ChatMessage[] = []

  constructor(
    private appState: AppStateService,
    private userService: UserService,
    private groupService: GroupService,
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
    this.userService.users$.pipe(takeUntil(this.destroy$)).subscribe((users) => {
      this.users = users
      this.updateUserChats()
    })

    this.groupService.groups$.pipe(takeUntil(this.destroy$)).subscribe((groups) => {
      this.groups = groups
      this.updateGroupChats()
    })

    this.chatService.messages$.pipe(takeUntil(this.destroy$)).subscribe((messages) => {
      this.allMessages = messages
      this.updateUserChats()
    })
  }

  onViewChange(view: string) {
    this.activeView = view
  }

  onChatSelect(type: 'user' | 'group', id: string, name: string) {
    this.appState.selectChat(type, id, name)
    this.chatService.setCurrentChat(type, id)
  }

  onCreateGroup() {
    this.showCreateGroupModal = true
  }

  onJoinGroup(groupId: string) {
    const group = this.groups.find((g) => g.id === groupId)
    if (!group) return

    group.members.push(this.appState.username)
    this.groupService.updateGroup(group)
  }

  onModalClose() {
    this.showCreateGroupModal = false
    this.newGroupName = ''
  }

  onModalGroupCreate() {
    if (this.newGroupName.trim()) {
      this.groupService.createGroup(this.newGroupName, this.appState.username)
      this.showCreateGroupModal = false
      this.newGroupName = ''
    }
  }

  private updateUserChats() {
    // Filtra usuários online (excluindo o usuário atual)
    const onlineUsers = this.users.filter((u) => u.name !== this.appState.username && u.online)

    // Encontra usuários offline com quem há conversas
    const usersWithMessages = this.getUsersWithMessages()
    const offlineUsersWithChats = usersWithMessages
      .filter(
        (username) =>
          username !== this.appState.username && !onlineUsers.some((u) => u.name === username)
      )
      .map((username) => {
        const lastMessage = this.getLastUserMessage(username)
        return {
          id: username,
          name: username,
          online: false,
          lastSeen: lastMessage ? lastMessage.timestamp : new Date(0), // Data padrão se não houver mensagens
          unread: 0
        } as User
      })

    // Combina e ordena todas as conversas
    const allUsers = [...onlineUsers, ...offlineUsersWithChats]

    // Remove duplicatas baseado no ID do usuário
    const uniqueUsers = this.removeDuplicateUsers(allUsers)

    // Ordena as conversas
    this.userChats = this.sortUserChats(uniqueUsers)
  }

  private getUsersWithMessages(): string[] {
    const users = new Set<string>()

    this.allMessages.forEach((msg) => {
      if (msg.chatType === 'user') {
        if (msg.fromCurrentUser) {
          users.add(msg.chatId)
        } else {
          users.add(msg.sender)
        }
      }
    })

    return Array.from(users)
  }

  private getLastUserMessage(username: string): ChatMessage | null {
    const userMessages = this.allMessages.filter(
      (msg) => msg.chatType === 'user' && (msg.chatId === username || msg.sender === username)
    )

    if (userMessages.length === 0) return null

    return userMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]
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
      // Primeiro: usuários online primeiro
      if (a.online && !b.online) return -1
      if (!a.online && b.online) return 1

      // Segundo: ordena pela última mensagem
      const aLastMsg = this.getLastUserMessage(a.name)
      const bLastMsg = this.getLastUserMessage(b.name)

      if (!aLastMsg && !bLastMsg) return a.name.localeCompare(b.name) // Ordena por nome se não há mensagens
      if (!aLastMsg) return 1
      if (!bLastMsg) return -1

      return bLastMsg.timestamp.getTime() - aLastMsg.timestamp.getTime()
    })
  }

  private updateGroupChats() {
    const userGroups = this.groups.filter((g) => g.members.includes(this.appState.username))

    this.groupChats = userGroups.map((g) => ({
      id: g.id,
      name: g.name,
      leader: g.leader,
      members: g.members.length,
      unread: 0,
      createdAt: new Date()
    }))

    userGroups.forEach((group) => {
      this.chatService.subscribeToGroup(group.id, this.appState.username)
    })

    this.availableGroups = this.groups
      .filter((g) => !g.members.includes(this.appState.username))
      .map((g) => ({
        id: g.id,
        name: g.name,
        leader: g.leader,
        members: g.members.length,
        description: `Grupo criado por ${g.leader}`
      }))
  }

  private formatLastSeen(date: Date): string {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)

    if (minutes < 1) return 'agora'
    if (minutes < 60) return `${minutes} min atrás`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h atrás`

    const days = Math.floor(hours / 24)
    return `${days}d atrás`
  }

  onModalGroupNameChange(value: string) {
    this.newGroupName = value
  }

  isSelected(type: 'user' | 'group', id: string): boolean {
    return this.appState.isSelectedChat(type, id)
  }

  get currentUsername(): string {
    return this.appState.username
  }
}
