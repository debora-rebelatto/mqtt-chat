import { Component, OnInit } from '@angular/core'
import { TranslateService, TranslateModule } from '@ngx-translate/core'
import { ChatContainerComponent } from './features/chat/chat-container/chat-container.component'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ChatContainerComponent, TranslateModule],
  template: '<app-chat-container/>'
})
export class AppComponent implements OnInit {
  username = ''

  constructor(private translate: TranslateService) {}

  ngOnInit() {
    this.translate.setFallbackLang('br')
    this.translate.use('br')
  }
}
