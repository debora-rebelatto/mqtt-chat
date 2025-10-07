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

@Component({
  selector: 'chat-area',
  templateUrl: 'chat-area.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, TranslatePipe, TimeFormatPipe]
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
}
