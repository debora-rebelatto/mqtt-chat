import mqtt, { MqttClient } from 'mqtt';
import { Logger } from '../utils/logger';
import { MQTT_CONFIG, USER_ID } from '../config';
import type { Message } from '../types/message.model';

export class MQTTService {
  private client: MqttClient | null = null;
  private messageCallbacks: ((message: Message) => void)[] = [];
  private presenceCallbacks: ((userId: string, isOnline: boolean) => void)[] = [];
  private typingCallbacks: ((userId: string, isTyping: boolean) => void)[] = [];

  constructor() {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.client = mqtt.connect(MQTT_CONFIG.BROKER_URL);

        this.client.on('connect', () => {
          Logger.info('Conectado ao broker MQTT');
          this.subscribeToPresence();
          resolve();
        });

        this.client.on('message', (topic, payload) => {
          this.handleIncomingMessage(topic, payload.toString());
        });

        this.client.on('error', (error) => {
          Logger.error('Erro MQTT:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private subscribeToPresence() {
    if (!this.client) return;

    // Inscrever para tópicos de presença
    this.client.subscribe(MQTT_CONFIG.TOPICS.USER_PRESENCE, (err) => {
      if (err) {
        Logger.error('Erro ao inscrever em presença:', err);
      }
    });
  }

  private handleIncomingMessage(topic: string, payload: string) {
    try {
      const data = JSON.parse(payload);

      if (topic === MQTT_CONFIG.TOPICS.USER_PRESENCE) {
        this.presenceCallbacks.forEach((callback) => callback(data.userId, data.isOnline));
        return;
      }

      if (topic.includes('/typing')) {
        this.typingCallbacks.forEach((callback) => callback(data.userId, data.isTyping));
        return;
      }

      if (topic.includes('/direct') || topic.includes('/messages')) {
        const message: Message = {
          ...data,
          timestamp: new Date(data.timestamp)
        };
        this.messageCallbacks.forEach((callback) => callback(message));
      }
    } catch (error) {
      Logger.error('Erro ao processar mensagem:', error);
    }
  }

  // Comunicação um-a-um
  sendDirectMessage(toUserId: string, content: string): void {
    if (!this.client) throw new Error('Cliente MQTT não conectado');

    const message: Message = {
      from: USER_ID, // ← Usar USER_ID diretamente
      to: toUserId,
      content,
      timestamp: new Date(),
      type: 'direct'
    };

    const topic = MQTT_CONFIG.TOPICS.DIRECT_MESSAGE(toUserId);
    this.client.publish(topic, JSON.stringify(message));
  }

  // Comunicação em grupo
  sendGroupMessage(groupId: string, content: string): void {
    if (!this.client) throw new Error('Cliente MQTT não conectado');

    const message: Message = {
      from: USER_ID,
      to: groupId,
      content,
      timestamp: new Date(),
      type: 'group'
    };

    const topic = MQTT_CONFIG.TOPICS.GROUP_MESSAGE(groupId);
    this.client.publish(topic, JSON.stringify(message));
  }

  // Entrar em um grupo (inscrever nos tópicos)
  joinGroup(groupId: string): void {
    if (!this.client) throw new Error('Cliente MQTT não conectado');

    this.client.subscribe(MQTT_CONFIG.TOPICS.GROUP_MESSAGE(groupId), (err) => {
      if (err) {
        Logger.error(`Erro ao entrar no grupo ${groupId}:`, err);
      } else {
        Logger.info(`Entrou no grupo: ${groupId}`);
      }
    });
  }

  // Sair de um grupo
  leaveGroup(groupId: string): void {
    if (!this.client) throw new Error('Cliente MQTT não conectado');

    this.client.unsubscribe(MQTT_CONFIG.TOPICS.GROUP_MESSAGE(groupId), (err) => {
      if (err) {
        Logger.error(`Erro ao sair do grupo ${groupId}:`, err);
      } else {
        Logger.info(`Saiu do grupo: ${groupId}`);
      }
    });
  }

  // Atualizar presença
  updatePresence(isOnline: boolean): void {
    if (!this.client) throw new Error('Cliente MQTT não conectado');

    const presenceMessage = {
      userId: USER_ID,
      isOnline,
      timestamp: new Date()
    };

    this.client.publish(MQTT_CONFIG.TOPICS.USER_PRESENCE, JSON.stringify(presenceMessage));
  }

  // Indicar que está digitando
  sendTypingIndicator(toUserId: string, isTyping: boolean): void {
    if (!this.client) throw new Error('Cliente MQTT não conectado');

    const typingMessage = {
      userId: USER_ID,
      isTyping,
      timestamp: new Date()
    };

    const topic = MQTT_CONFIG.TOPICS.USER_TYPING(toUserId);
    this.client.publish(topic, JSON.stringify(typingMessage));
  }

  // Callbacks
  onMessage(callback: (message: Message) => void): void {
    this.messageCallbacks.push(callback);
  }

  onPresenceChange(callback: (userId: string, isOnline: boolean) => void): void {
    this.presenceCallbacks.push(callback);
  }

  onTyping(callback: (userId: string, isTyping: boolean) => void): void {
    this.typingCallbacks.push(callback);
  }

  disconnect(): void {
    if (this.client) {
      this.updatePresence(false);
      this.client.end();
      Logger.info('Desconectado do broker MQTT');
    }
  }
}
