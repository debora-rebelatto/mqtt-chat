import { Injectable } from '@angular/core'
import * as Paho from 'paho-mqtt'

@Injectable({
  providedIn: 'root'
})
export class MqttService {
  private client: Paho.Client | null = null
  private messageCallbacks: Map<string, ((message: string) => void)[]> = new Map()

  connect(host: string, port: number, clientId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client = new Paho.Client(host, port, clientId)

      this.client.onMessageArrived = (message: Paho.Message) => {
        this.handleMessage(message)
      }

      this.client.connect({
        onSuccess: () => resolve(),
        onFailure: (error) => reject(error),
        timeout: 30,
        cleanSession: false
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
      this.client?.subscribe(topic)
    }
    this.messageCallbacks.get(topic)!.push(callback)
  }

  publish(topic: string, message: string, retained: boolean = false) {
    if (!this.client) return

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
