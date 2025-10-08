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
import { TranslateModule } from '@ngx-translate/core'

import { LucideAngularModule, MessageCircle } from 'lucide-angular'
import { SelectedChat } from '../../../models/selected-chat.models'
import { Message, User } from '../../../models'
import { TimeFormatPipe } from '../../../pipes/time-format.pipe'

@Component({
  selector: 'chat-area',
  templateUrl: 'chat-area.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, TimeFormatPipe, TranslateModule]
})
export class ChatAreaComponent implements AfterViewInit, OnChanges {
  readonly MessageCircle = MessageCircle

  @ViewChild('messagesContainer') messagesContainer!: ElementRef

  @Input() selectedChat: SelectedChat | null = null
  @Input() messages: Message[] = []
  @Input() inputMensagem = ''
  @Input() userStatus = ''
  @Input() currentUser: User | null = null

  @Output() messageSend = new EventEmitter<void>()
  @Output() messageInputChange = new EventEmitter<string>()
  @Output() keyPress = new EventEmitter<KeyboardEvent>()

  onSendMessage() {
    this.messageSend.emit()
  }

  onInputChange(value: string) {
    this.messageInputChange.emit(value)
  }

  onKeyPress(event: KeyboardEvent) {
    this.keyPress.emit(event)
  }

  private scrollToBottom(delay: number = 0) {
    setTimeout(() => {
      if (this.messagesContainer?.nativeElement) {
        const element = this.messagesContainer.nativeElement
        element.scrollTop = element.scrollHeight
      }
    }, delay)
  }

  ngAfterViewInit() {
    this.scrollToBottom(100)
  }

  ngOnChanges() {
    if (this.selectedChat || this.messages.length > 0) {
      this.scrollToBottom(150)
    }
  }

  isCurrentUser(msg: Message): boolean {
    return msg.sender.id === this.currentUser?.id
  }
}
