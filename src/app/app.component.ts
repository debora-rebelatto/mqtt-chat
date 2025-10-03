import { Component } from '@angular/core'
import { ChatContainerComponent } from './components/chat-container/chat-container.component'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ChatContainerComponent],
  template: '<app-chat-container/>'
})
export class AppComponent {}
