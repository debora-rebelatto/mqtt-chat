import { Component, Output, EventEmitter } from '@angular/core'
import { FormsModule } from '@angular/forms'

@Component({
  selector: 'app-message-input',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './message-input.component.html'
})
export class MessageInputComponent {
  @Output() messageSent = new EventEmitter<string>()

  inputMensagem: string = ''

  sendMessage() {
    const texto = this.inputMensagem.trim()
    if (!texto) return

    this.messageSent.emit(texto)
    this.inputMensagem = ''
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.sendMessage()
    }
  }
}
