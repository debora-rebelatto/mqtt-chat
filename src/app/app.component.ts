import { Component, inject } from '@angular/core'
import { MqttService } from './services/mqtt.service'
import { LoginComponent } from './components/login/login.component'
import { DateShortPipe } from './pipes/date-short.pipe'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: true,
  imports: [LoginComponent, DateShortPipe]
})
export class AppComponent {
  title = 'Chat MQTT'
  mqttService = inject(MqttService)

  constructor() {
    console.log('AppComponent initialized')
  }
}
