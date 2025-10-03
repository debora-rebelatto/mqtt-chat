import { Component, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'

@Component({
  selector: 'app-message-input',
  templateUrl: './message-input.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class MessageInputComponent {
  @ViewChild('messageInput') messageInput!: ElementRef<HTMLInputElement>

  @Output() messageSent = new EventEmitter<string>()

  message = ''

  sendMessage() {
    if (this.message.trim()) {
      this.messageSent.emit(this.message.trim())
      this.message = ''
    }
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.sendMessage()
    }
  }
}
