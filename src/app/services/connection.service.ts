import { Injectable } from '@angular/core'
import * as Paho from 'paho-mqtt'

@Injectable({
  providedIn: 'root'
})
export class MqttConnectionService {
  private client!: Paho.Client
  private isConnected = false

  onMessageArrived?: (message: Paho.Message) => void
  onConnectionLost?: (responseObject: ConnectionLostEvent) => void

  initializeClient(brokerHost: string, brokerPort: number, clientId: string): void {
    this.client = new Paho.Client(brokerHost, brokerPort, '/mqtt', clientId)

    this.client.onMessageArrived = (message) => {
      if (this.onMessageArrived) {
        this.onMessageArrived(message)
      }
    }

    this.client.onConnectionLost = (responseObject) => {
      this.isConnected = false
      if (this.onConnectionLost) {
        this.onConnectionLost(responseObject)
      }
    }
  }

  connect(options: Paho.ConnectionOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.connect({
        ...options,
        onSuccess: () => {
          this.isConnected = true
          resolve()
        },
        onFailure: (error) => {
          this.isConnected = false
          reject(error)
        }
      })
    })
  }

  disconnect(): void {
    if (this.isConnected) {
      this.client.disconnect()
      this.isConnected = false
    }
  }

  subscribe(topic: string, qos: 0 | 1 | 2 = 0): void {
    if (this.isConnected) {
      this.client.subscribe(topic, { qos })
    } else {
      console.error('MQTT Client não está conectado para assinar tópicos')
    }
  }

  unsubscribe(topic: string): void {
    if (this.isConnected) {
      this.client.unsubscribe(topic)
    } else {
      console.error('MQTT Client não está conectado para desassinar tópicos')
    }
  }

  publish(topic: string, payload: any, qos: 0 | 1 | 2 = 0): void {
    if (!this.isConnected) {
      console.error('MQTT Client não está conectado para publicar mensagens')
      return
    }
    const message = new Paho.Message(
      typeof payload === 'string' ? payload : JSON.stringify(payload)
    )
    message.destinationName = topic
    message.qos = qos

    this.client.send(message)
  }

  getConnectionStatus(): boolean {
    return this.isConnected
  }
}
