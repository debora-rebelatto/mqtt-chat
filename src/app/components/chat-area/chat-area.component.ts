import { Component, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat-area',
  templateUrl: 'chat-area.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class ChatAreaComponent {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  
  @Input() selectedChat: { type: string; id: string; name: string } | null = null;
  @Input() messages: {
    id: string;
    sender: string;
    content: string;
    timestamp: string;
    fromCurrentUser: boolean;
  }[] = [];
  @Input() inputMensagem = '';
  @Input() userStatus = '';
  
  @Output() messageSend = new EventEmitter<void>();
  @Output() messageInputChange = new EventEmitter<string>();
  @Output() keyPress = new EventEmitter<KeyboardEvent>();
  @Output() scroll = new EventEmitter<void>();

  onSendMessage() {
    this.messageSend.emit();
  }

  onInputChange(value: string) {
    this.messageInputChange.emit(value);
  }

  onKeyPress(event: KeyboardEvent) {
    this.keyPress.emit(event);
  }

  onScroll() {
    this.scroll.emit();
  }

  scrollToBottom() {
    setTimeout(() => {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop =
          this.messagesContainer.nativeElement.scrollHeight;
      }
    }, 100);
  }
}