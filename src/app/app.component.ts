import { Component, OnInit } from '@angular/core'
import { FormsModule } from '@angular/forms'
import * as Paho from 'paho-mqtt'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: true,
  imports: [FormsModule]
})
export class AppComponent {
  private readonly BROKER_HOST = 'test.mosquitto.org'
  private readonly BROKER_PORT = 8080
  private readonly CHAT_TOPIC = 'meu-chat-mqtt/sala-geral'

  private client: Paho.Client | null = null
  username: string = ''
  mensagens: string[] = []
  inputMensagem: string = ''
  conectado: boolean = false

  conectar() {
    if (!this.username.trim()) {
      alert('Digite um nome!')
      return
    }

    const clientId = `chat_${Math.random().toString(16).substring(2, 10)}`
    this.client = new Paho.Client(this.BROKER_HOST, this.BROKER_PORT, clientId)

    this.client.onConnectionLost = (response: Paho.MQTTError) => {
      if (response.errorCode !== 0) {
        console.log('Conexão perdida:', response.errorMessage)
        this.conectado = false
      }
    }

    this.client.onMessageArrived = (message: Paho.Message) => {
      this.mensagens.push(message.payloadString)
    }

    this.client.connect({
      onSuccess: () => {
        console.log('Conectado!')
        this.client!.subscribe(this.CHAT_TOPIC)
        this.conectado = true
      },
      onFailure: (error: Paho.MQTTError) => {
        alert('Falha na conexão: ' + error.errorMessage)
      }
    })
  }

  enviarMensagem() {
    if (!this.client || !this.conectado) {
      alert('Não conectado ao chat!')
      return
    }

    const texto = this.inputMensagem.trim()
    if (!texto) return

    const mensagemFormatada = `${this.username}: ${texto}`
    const message = new Paho.Message(mensagemFormatada)
    message.destinationName = this.CHAT_TOPIC
    this.client.send(message)

    this.inputMensagem = ''
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.enviarMensagem()
    }
  }
}
