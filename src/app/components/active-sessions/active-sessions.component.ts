import { Component, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { MqttFacadeService } from '../../services/mqtt-facade.service'
import { DateShortPipe } from '../../pipes/date-short.pipe'

@Component({
  selector: 'active-sessions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './active-sessions.component.html'
})
export class ActiveSessionsComponent {
  mqttFacade = inject(MqttFacadeService)
}
