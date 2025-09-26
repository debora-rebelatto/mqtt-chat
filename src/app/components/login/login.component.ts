import { Component, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { MqttFacadeService } from '../../services/mqtt-facade.service' // Novo serviço fachada

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  userId: string = ''
  isConnecting: boolean = false
  mqttFacade = inject(MqttFacadeService)

  get currentConnectionState(): string {
    if (this.isConnecting) return 'Conectando...'
    return this.isConnected ? 'Conectado' : 'Desconectado'
  }

  async connect(): Promise<void> {
    if (!this.userId.trim()) {
      alert('Por favor, informe um ID de usuário')
      return
    }

    this.isConnecting = true

    try {
      await this.mqttFacade.connect(this.userId)
      console.log('Conectado com sucesso!')
    } catch (error) {
      console.error('Erro na conexão:', error)
      alert('Erro ao conectar. Tente novamente.')
    } finally {
      this.isConnecting = false
    }
  }

  disconnect(): void {
    this.mqttFacade.disconnect()
  }

  get isConnected(): boolean {
    return this.mqttFacade.getConnectedStatus()
  }
}
