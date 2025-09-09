import { Logger } from '../utils/logger';
import { MQTT_CONFIG, USER_ID } from '../config';
import type { Message } from '../types/message.model';
import type { Group } from '../types/group.model';
import type { User } from '../types/user.model';
import type { MQTTService } from './mqtt-service';

export class UserService {
  private knownUsers: Map<string, User> = new Map();
  private groups: Map<string, Group> = new Map();
  private mqttService: MQTTService;

  constructor(mqttService: MQTTService) {
    this.mqttService = mqttService;
    this.setupListeners();
  }

  private setupListeners(): void {
    this.mqttService.onPresenceChange((userId, isOnline) => {
      const user = this.knownUsers.get(userId);
      if (user) {
        user.isOnline = isOnline;
        Logger.info(`Usuário ${user.name} está ${isOnline ? 'online' : 'offline'}`);
      }
    });

    this.mqttService.onMessage((message) => {
      this.handleIncomingMessage(message);
    });
  }

  addKnownUser(user: User): void {
    this.knownUsers.set(user.id, user);
    Logger.info(`Usuário conhecido adicionado: ${user.name} (${user.id})`);
  }

  createGroup(name: string, memberIds: string[]): Group {
    const groupId = `group_${Math.random().toString(36).substr(2, 9)}`;
    const group: Group = {
      id: groupId,
      name,
      members: [...memberIds, USER_ID], // Inclui o criador
      createdBy: USER_ID
    };

    this.groups.set(groupId, group);
    this.mqttService.joinGroup(groupId);
    Logger.info(`Grupo criado: ${name} (${groupId})`);

    return group;
  }

  joinGroup(groupId: string): void {
    this.mqttService.joinGroup(groupId);
  }

  leaveGroup(groupId: string): void {
    this.mqttService.leaveGroup(groupId);
  }

  sendMessageToUser(userId: string, content: string): void {
    if (!this.knownUsers.has(userId)) {
      Logger.warn(`Usuário ${userId} não é conhecido. Mensagem pode não ser entregue.`);
    }
    this.mqttService.sendDirectMessage(userId, content);
    Logger.info(`Mensagem enviada para ${userId}: ${content}`);
  }

  sendMessageToGroup(groupId: string, content: string): void {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`Grupo ${groupId} não encontrado`);
    }
    this.mqttService.sendGroupMessage(groupId, content);
    Logger.info(`Mensagem enviada para grupo ${group.name}: ${content}`);
  }

  private handleIncomingMessage(message: Message): void {
    if (message.type === 'direct' && message.from !== USER_ID) {
      const user = this.knownUsers.get(message.from) || {
        id: message.from,
        name: 'Desconhecido',
        isOnline: true
      };
      Logger.info(`Mensagem de ${user.name}: ${message.content}`);
    } else if (message.type === 'group') {
      const group = this.groups.get(message.to as string);
      const groupName = group ? group.name : 'Grupo Desconhecido';
      const user = this.knownUsers.get(message.from) || {
        id: message.from,
        name: 'Desconhecido',
        isOnline: true
      };
      Logger.info(`[${groupName}] ${user.name}: ${message.content}`);
    }
  }

  getKnownUsers(): User[] {
    return Array.from(this.knownUsers.values());
  }

  getGroups(): Group[] {
    return Array.from(this.groups.values());
  }
}
