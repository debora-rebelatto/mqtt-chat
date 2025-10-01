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
  private readonly HISTORY_TOPIC = 'meu-chat-mqtt/sala-geral/history'

  private client: Paho.Client | null = null
  username: string = ''
  messages: string[] = []
  inputMensagem: string = ''
  connected: boolean = false
  private isUpdatingHistory: boolean = false

  connect() {
    if (!this.username.trim()) {
      alert('Digite um nome!')
      return
    }

    const clientId = `chat_${Math.random().toString(16).substring(2, 10)}`
    this.client = new Paho.Client(this.BROKER_HOST, this.BROKER_PORT, clientId)

    this.client.onConnectionLost = (response: Paho.MQTTError) => {
      if (response.errorCode !== 0) {
        this.connected = false
      }
    }

    this.client.onMessageArrived = (message: Paho.Message) => {
      if (message.destinationName === this.CHAT_TOPIC) {
        if (!this.isUpdatingHistory) {
          this.messages.push(message.payloadString)
        }
      } else if (message.destinationName === this.HISTORY_TOPIC) {
        this.processHistoryMessage(message.payloadString)
      }
    }

    this.client.connect({
      onSuccess: () => {
        this.client!.subscribe(this.CHAT_TOPIC)
        this.client!.subscribe(this.HISTORY_TOPIC)
        this.connected = true
        this.requestHistory()
      }
    })
  }

  private requestHistory() {
    const requestMessage = new Paho.Message('REQUEST_HISTORY')
    requestMessage.destinationName = this.HISTORY_TOPIC
    this.client!.send(requestMessage)
  }

  private processHistoryMessage(historyData: string) {
    if (historyData && historyData !== 'REQUEST_HISTORY') {
      const historyMessages = JSON.parse(historyData)
      if (Array.isArray(historyMessages)) {
        this.messages = historyMessages
      }
    }
  }

  sendMessage() {
    if (!this.client || !this.connected) {
      alert('Não conectado ao chat!')
      return
    }

    const texto = this.inputMensagem.trim()
    if (!texto) return

    const formattedMessage = `${this.username}: ${texto}`

    this.messages.push(formattedMessage)

    const message = new Paho.Message(formattedMessage)
    message.destinationName = this.CHAT_TOPIC
    this.client.send(message)

    this.updateRetainedHistory()

    this.inputMensagem = ''
  }

  private updateRetainedHistory() {
    this.isUpdatingHistory = true

    const recentHistory = this.messages.slice(-50)
    const historyMessage = new Paho.Message(JSON.stringify(recentHistory))
    historyMessage.destinationName = this.HISTORY_TOPIC
    historyMessage.retained = true
    this.client!.send(historyMessage)

    setTimeout(() => {
      this.isUpdatingHistory = false
    }, 100)
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.sendMessage()
    }
  }
}
