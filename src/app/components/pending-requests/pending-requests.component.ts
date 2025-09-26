import { Component, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { MqttFacadeService } from '../../services/mqtt-facade.service'
import { DateShortPipe } from '../../pipes/date-short.pipe'

@Component({
  selector: 'pending-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, DateShortPipe],
  templateUrl: './pending-requests.component.html'
})
export class PendingRequestsComponent {
  mqttFacade = inject(MqttFacadeService)
}
