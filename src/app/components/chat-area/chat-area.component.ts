import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit, OnChanges } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { LucideAngularModule, MessageCircle } from 'lucide-angular'
import { TranslatePipe } from '../../pipes/translate.pipe'
import { Messages } from '../../models/messages.model'

@Component({
  selector: 'chat-area',
  templateUrl: 'chat-area.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, TranslatePipe]
})
export class ChatAreaComponent implements AfterViewInit, OnChanges {
  readonly MessageCircle = MessageCircle

  @ViewChild('messagesContainer') messagesContainer!: ElementRef

  @Input() selectedChat: { type: string; id: string; name: string } | null = null
  @Input() messages: Messages[] = []
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
