import { Component, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { MqttService } from '../../services/mqtt.service'

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  userId: string = ''
  isConnecting: boolean = false
  mqttService = inject(MqttService)

  get currentConnectionState(): string {
    return this.isConnecting ? 'Conectando' : 'Conectado'
  }

  async connect(): Promise<void> {
    if (!this.userId.trim()) {
      alert('Por favor, informe um ID de usuário')
      return
    }

    this.isConnecting = true

    try {
      await this.mqttService.connect(this.userId)
      console.log('Conectado com sucesso!')
    } catch (error) {
      console.error('Erro na conexão:', error)
      alert('Erro ao conectar. Tente novamente.')
    } finally {
      this.isConnecting = false
    }
  }

  disconnect(): void {
    this.mqttService.disconnect()
    this.userId = ''
  }

  get isConnected(): boolean {
    return this.mqttService.getConnectedStatus()
  }
}
