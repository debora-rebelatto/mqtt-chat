import { Injectable } from '@angular/core'
import * as Paho from 'paho-mqtt'

@Injectable({
  providedIn: 'root'
})
export class MqttService {
  private client: Paho.Client | null = null
  private messageCallbacks: Map<string, ((message: string) => void)[]> = new Map()
  private currentClientId: string = ''

  connect(clientId: string): Promise<void> {
    this.currentClientId = clientId
    return new Promise((resolve, reject) => {
      this.client = new Paho.Client('localhost', 8081, clientId)

      this.client.onMessageArrived = (message: Paho.Message) => {
        this.handleMessage(message)
      }

      this.client.onConnectionLost = () => {
        this.client = null

        setTimeout(() => {
          this.reconnect()
        }, 2000)
      }

      this.client.connect({
        onSuccess: () => {
          this.resubscribeAll()
          resolve()
        },
        onFailure: (error) => {
          reject(error)
        },
        timeout: 30,
        cleanSession: false,
        keepAliveInterval: 60,
        useSSL: false
      })
    })
  }

  private reconnect() {
    if (!this.client && this.currentClientId) {
      this.connect(this.currentClientId).catch(() => {
        setTimeout(() => this.reconnect(), 5000)
      })
    }
  }

  private resubscribeAll() {
    this.messageCallbacks.forEach((callbacks, topic) => {
      if (this.client && this.client.isConnected()) {
        this.client.subscribe(topic, { qos: 1 })
      }
    })
  }

  disconnect() {
    if (this.client) {
      this.client.disconnect()
      this.client = null
    }
  }

  subscribe(topic: string, callback: (message: string) => void) {
    if (!this.messageCallbacks.has(topic)) {
      this.messageCallbacks.set(topic, [])

      if (this.client && this.client.isConnected()) {
        this.client.subscribe(topic, { qos: 1 })
      }
    }
    this.messageCallbacks.get(topic)!.push(callback)
  }

  publish(topic: string, message: string, retained: boolean = false, qos: 0 | 1 | 2 = 1): boolean {
    if (!this.client || !this.client.isConnected()) {
      return false
    }

    try {
      const mqttMessage = new Paho.Message(message) // Cria objeto de mensagem
      mqttMessage.destinationName = topic // Define tópico destino
      mqttMessage.retained = retained
      mqttMessage.qos = qos
      this.client.send(mqttMessage) // Envia mensagem ao broker
      return true
    } catch (error) {
      console.error('Failed to publish message:', error)
      return false
    }
  }

  isConnected(): boolean {
    return this.client?.isConnected() || false
  }

  forceResubscribe() {
    if (this.isConnected()) {
      this.resubscribeAll()
    }
  }

  private handleMessage(message: Paho.Message) {
    const callbacks = this.messageCallbacks.get(message.destinationName) || []
    callbacks.forEach((callback) => callback(message.payloadString))
  }
}
