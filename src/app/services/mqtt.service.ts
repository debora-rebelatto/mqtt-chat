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
        console.log('MQTT connection lost')
        this.client = null
      }

      this.client.connect({
        onSuccess: () => {
          console.log('MQTT connected successfully')
          resolve()
        },
        onFailure: (error) => {
          console.error('MQTT connection failed:', error)
          reject(error)
        },
        timeout: 30,
        cleanSession: false, // ✅ Manter sessão para persistência
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
        // ✅ Usar QoS 1 para garantir entrega
        this.client.subscribe(topic, { qos: 1 })
        console.log(`Subscribed to topic: ${topic} with QoS 1`)
      }
    }
    this.messageCallbacks.get(topic)!.push(callback)
  }

  publish(topic: string, message: string, retained: boolean = false, qos: 0 | 1 | 2 = 1): boolean {
    if (!this.client || !this.client.isConnected()) {
      console.warn('MQTT client is not connected. Cannot publish message to topic:', topic)
      return false
    }

    try {
      const mqttMessage = new Paho.Message(message)
      mqttMessage.destinationName = topic
      mqttMessage.retained = retained
      mqttMessage.qos = qos // ✅ Usar QoS para garantir entrega
      this.client.send(mqttMessage)
      console.log(`Message published to ${topic} with QoS ${qos}`)
      return true
    } catch (error) {
      console.error('Failed to publish message:', error)
      return false
    }
  }

  isConnected(): boolean {
    return this.client?.isConnected() || false
  }

  private handleMessage(message: Paho.Message) {
    const callbacks = this.messageCallbacks.get(message.destinationName) || []
    callbacks.forEach((callback) => callback(message.payloadString))
  }
}
