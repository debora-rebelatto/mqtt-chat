import { Component, inject } from '@angular/core'
import { LoginComponent } from './components/login/login.component'
import { DateShortPipe } from './pipes/date-short.pipe'
import { MqttFacadeService } from './services/mqtt-facade.service'
import { AppHeaderComponent } from './components/header/header.component'
import { PendingRequestsComponent } from './components/pending-requests/pending-requests.component'
import { ActiveSessionsComponent } from './components/active-sessions/active-sessions.component'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: true,
  imports: [LoginComponent, AppHeaderComponent, PendingRequestsComponent, ActiveSessionsComponent]
})
export class AppComponent {
  title = 'Chat MQTT'
  mqttFacade = inject(MqttFacadeService)

  constructor() {
    console.log('AppComponent initialized')
  }
}
