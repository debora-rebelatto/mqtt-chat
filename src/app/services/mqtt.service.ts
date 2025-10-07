import { Injectable } from '@angular/core'
import * as Paho from 'paho-mqtt'

@Injectable({
  providedIn: 'root'
})
export class MqttService {
  private client: Paho.Client | null = null
  private messageCallbacks: Map<string, ((message: string) => void)[]> = new Map()

  connect(clientId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client = new Paho.Client('localhost', 8081, clientId)

      this.client.onMessageArrived = (message: Paho.Message) => {
        this.handleMessage(message)
      }

      this.client.onConnectionLost = () => {
        this.client = null
      }

      this.client.connect({
        onSuccess: () => {
          resolve()
        },
        onFailure: (error) => {
          reject(error)
        },
        timeout: 30,
        cleanSession: true,
        keepAliveInterval: 60,
        useSSL: false
      })
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
        this.client.subscribe(topic)
      }
    }
    this.messageCallbacks.get(topic)!.push(callback)
  }

  publish(topic: string, message: string, retained: boolean = false) {
    if (!this.client || !this.client.isConnected()) {
      console.warn('MQTT client is not connected. Cannot publish message to topic:', topic)
      return
    }

    const mqttMessage = new Paho.Message(message)
    mqttMessage.destinationName = topic
    mqttMessage.retained = retained
    this.client.send(mqttMessage)
  }

  isConnected(): boolean {
    return this.client?.isConnected() || false
  }

  private handleMessage(message: Paho.Message) {
    const callbacks = this.messageCallbacks.get(message.destinationName) || []
    callbacks.forEach((callback) => callback(message.payloadString))
  }
}
