import { Component, OnInit, OnDestroy } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { CommonModule } from '@angular/common'
import { Subject, takeUntil } from 'rxjs'
import { SidebarComponent } from '../../../components/sidebar/sidebar.component'
import { PageHeaderComponent } from '../../../components/page-header/page-header.component'
import { ChatAreaComponent } from '../chat-area/chat-area.component'
import { Group, Message, User } from '../../../models'
import { GroupService, ChatService, AppStateService, InvitationService } from '../../../services'
import { ChatType } from '../../../models/chat-type.component'

@Component({
  selector: 'app-chat-container',
  templateUrl: './chat-container.component.html',
  standalone: true,
  imports: [FormsModule, CommonModule, SidebarComponent, PageHeaderComponent, ChatAreaComponent]
})
export class ChatContainerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>()

  inputMensagem = ''
  userChats: User[] = []
  groupChats: Group[] = []
  availableGroups: Group[] = []
  messages: Message[] = []

  constructor(
    private groupService: GroupService,
    private chatService: ChatService,
    private invitationService: InvitationService,
    public appState: AppStateService
  ) {}

  ngOnInit() {
    this.setupSubscriptions()
  }

  ngOnDestroy() {
    this.destroy$.next()
    this.destroy$.complete()
  }

  private setupSubscriptions() {
    this.chatService.userChats$.pipe(takeUntil(this.destroy$)).subscribe((userChats) => {
      this.userChats = userChats
    })

    this.chatService.groupChats$.pipe(takeUntil(this.destroy$)).subscribe((groupChats) => {
      this.groupChats = groupChats
    })

    this.chatService.availableGroups$
      .pipe(takeUntil(this.destroy$))
      .subscribe((availableGroups) => {
        this.availableGroups = availableGroups
      })

    this.chatService.currentMessages$.pipe(takeUntil(this.destroy$)).subscribe((messages) => {
      this.messages = messages
    })
  }

  onUserChange(user: User) {
    this.appState.setUser(user)
  }

  onConnectionChange(connected: boolean) {
    this.appState.setConnected(connected)
  }

  onGroupCreate(groupName: string) {
    if (!this.appState.user) return
    this.groupService.createGroup(groupName, this.appState.user)
  }

  onJoinGroup(groupId: string) {
    this.joinGroup(groupId)
  }

  onMessageInputChange(value: string) {
    this.inputMensagem = value
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.sendMessage()
    }
  }

  selectChat(type: ChatType, id: string, name: string) {
    this.appState.selectChat(type, id, name)
  }

  sendMessage() {
    if (!this.inputMensagem.trim() || !this.appState.selectedChat || !this.appState.user) {
      return
    }

    if (this.appState.selectedChat.isUser()) {
      const targetUser = new User(
        this.appState.selectedChat.id,
        this.appState.selectedChat.name,
        false,
        new Date()
      )

      this.chatService.sendUserMessage(this.appState.user, targetUser, this.inputMensagem)
    } else if (this.appState.selectedChat.isGroup()) {
      this.chatService.sendGroupMessage(
        this.appState.selectedChat.id,
        this.appState.user,
        this.inputMensagem
      )
    }

    this.inputMensagem = ''
  }

  joinGroup(groupId: string) {
    this.groupService.groups$.pipe(takeUntil(this.destroy$)).subscribe((groups) => {
      const group = groups.find((g) => g.id === groupId)
      if (group && this.appState.user) {
        this.invitationService.requestJoinGroup(
          group.id,
          group.name,
          this.appState.user,
          group.leader
        )
      }
    })
  }
}
