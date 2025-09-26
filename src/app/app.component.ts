import { Component, inject } from '@angular/core'
import { LoginComponent } from './components/login/login.component'
import { DateShortPipe } from './pipes/date-short.pipe'
import { MqttFacadeService } from './services/mqtt-facade.service'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: true,
  imports: [LoginComponent, DateShortPipe]
})
export class AppComponent {
  title = 'Chat MQTT'
  mqttFacade = inject(MqttFacadeService)

  constructor() {
    console.log('AppComponent initialized')
  }
}
