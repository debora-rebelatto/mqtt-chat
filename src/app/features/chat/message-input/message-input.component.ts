import { Component, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { TranslatePipe } from '../../../pipes/translate.pipe'

@Component({
  selector: 'app-message-input',
  templateUrl: './message-input.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe]
})
export class MessageInputComponent {
  @Output() messageSent = new EventEmitter<string>()

  message = ''

  sendMessage() {
    if (this.message.trim()) {
      this.messageSent.emit(this.message.trim())
      this.message = ''
    }
  }
}
