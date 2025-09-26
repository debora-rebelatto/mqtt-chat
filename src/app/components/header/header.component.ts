import { Component, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { MqttFacadeService } from '../../services/mqtt-facade.service'

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './header.component.html'
})
export class AppHeaderComponent {
  mqttFacade = inject(MqttFacadeService)
}
