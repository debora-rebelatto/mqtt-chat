import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnChanges
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { LucideAngularModule, MessageCircle } from 'lucide-angular'
import { SelectedChat } from '../../../models/selected-chat.models'
import { TranslatePipe } from '../../../pipes/translate.pipe'
import { AppStateService } from '../../../services'
import { ChatMessage } from '../../../models'
import { TimeFormatPipe } from '../../../pipes/time-format.pipe'
import { GroupMembersModalComponent } from '../../groups/group-members-modal/group-members-modal.component'

@Component({
  selector: 'chat-area',
  templateUrl: 'chat-area.component.html',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    LucideAngularModule, 
    TimeFormatPipe, 
    TranslateModule,
    GroupMembersModalComponent
  ]
})
export class ChatAreaComponent implements AfterViewInit, OnChanges {
  readonly MessageCircle = MessageCircle

  @ViewChild('messagesContainer') messagesContainer!: ElementRef

  @Input() selectedChat: SelectedChat | null = null
  @Input() messages: ChatMessage[] = []
  @Input() inputMensagem = ''
  @Input() userStatus = ''

  @Output() messageSend = new EventEmitter<void>()
  @Output() messageInputChange = new EventEmitter<string>()
  @Output() keyPress = new EventEmitter<KeyboardEvent>()

  // Propriedade para controlar o modal
  showMembersModal = false

  constructor(private appState: AppStateService) {}

  // Métodos existentes do chat
  onSendMessage() {
    this.messageSend.emit()
  }

  onInputChange(value: string) {
    this.messageInputChange.emit(value)
  }

  onKeyPress(event: KeyboardEvent) {
    this.keyPress.emit(event)
  }

  scrollToBottom() {
    setTimeout(() => {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop =
          this.messagesContainer.nativeElement.scrollHeight
      }
    }, 100)
  }

  ngAfterViewInit() {
    this.scrollToBottom()
  }

  ngOnChanges() {
    if (this.selectedChat || this.messages.length > 0) {
      setTimeout(() => this.scrollToBottom(), 150)
    }
  }

  // getSelectedUserStatus(): string {
  //   if (this.appState.selectedChat?.isUser()) {
  //     const user = this.userChats.find((u) => u.id === this.appState.selectedChat?.id)
  //     return user?.online ? 'Online' : `Visto ${user?.lastSeen}`
  //   }
  //   return ''
  // }

  // Métodos para o modal de membros
  openGroupMembers() {
    if (this.selectedChat?.isGroup()) {
      this.showMembersModal = true
    }
  }

  closeMembersModal() {
    this.showMembersModal = false
  }
  
}