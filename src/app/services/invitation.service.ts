import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { MqttService } from './mqtt.service'
import { GroupInvitation } from '../models/group-invitation.model'

@Injectable({
  providedIn: 'root'
})
export class InvitationService {
  private invitationsSubject = new BehaviorSubject<GroupInvitation[]>([])
  public invitations$ = this.invitationsSubject.asObservable()
  private readonly STORAGE_KEY_BASE = 'mqtt-chat-invitations'
  private currentUsername: string = ''

  constructor(private mqttService: MqttService) {
    // Não carregar no constructor - aguardar initialize
  }

  initialize(username: string) {
    console.log(`InvitationService: ${username} se inscrevendo no tópico meu-chat-mqtt/invitations/${username}`)
    
    this.currentUsername = username
    this.loadInvitationsFromStorage() // Carregar convites específicos do usuário
    
    this.mqttService.subscribe(`meu-chat-mqtt/invitations/${username}`, (message) => {
      console.log(`${username} recebeu mensagem no seu tópico de convites:`, message)
      this.handleInvitation(message)
    })

    this.mqttService.subscribe('meu-chat-mqtt/invitations/responses', (message) => {})
  }

  private get STORAGE_KEY(): string {
    return `${this.STORAGE_KEY_BASE}-${this.currentUsername}`
  }

  sendInvitation(groupId: string, groupName: string, from: string, to: string) {
    const invitation: GroupInvitation = {
      id: `inv_${Date.now()}_${Math.random().toString(16).substring(2, 8)}`,
      groupId: groupId,
      groupName: groupName,
      invitedBy: from,
      timestamp: new Date()
    }

    const payload = {
      ...invitation,
      to: to
    }

    this.mqttService.publish(`meu-chat-mqtt/invitations/${to}`, JSON.stringify(payload))
  }

  // Solicitar ingresso em um grupo (usuário pede para entrar)
  requestJoinGroup(groupId: string, groupName: string, requester: string, leader: string) {
    const joinRequest: GroupInvitation = {
      id: `req_${Date.now()}_${Math.random().toString(16).substring(2, 8)}`,
      groupId: groupId,
      groupName: groupName,
      invitedBy: requester, // Quem está pedindo para entrar
      timestamp: new Date()
    }

    const payload = {
      ...joinRequest,
      to: leader,
      type: 'join_request' // Diferencia de convite normal
    }

    console.log(`ENVIANDO: ${requester} solicitando ingresso no grupo "${groupName}" para o líder ${leader}`)
    console.log(`TÓPICO DESTINO: meu-chat-mqtt/invitations/${leader}`)
    console.log('PAYLOAD:', JSON.stringify(payload, null, 2))
    
    this.mqttService.publish(`meu-chat-mqtt/invitations/${leader}`, JSON.stringify(payload))
  }

  acceptInvitation(invitation: GroupInvitation, username: string) {
    const response = {
      invitationId: invitation.id,
      groupId: invitation.groupId,
      username: username,
      accepted: true,
      timestamp: new Date()
    }

    this.mqttService.publish('meu-chat-mqtt/invitations/responses', JSON.stringify(response))
    this.removeInvitation(invitation.id)
  }

  rejectInvitation(invitation: GroupInvitation, username: string) {
    const response = {
      invitationId: invitation.id,
      groupId: invitation.groupId,
      username: username,
      accepted: false,
      timestamp: new Date()
    }

    this.mqttService.publish('meu-chat-mqtt/invitations/responses', JSON.stringify(response))
    this.removeInvitation(invitation.id)
  }

  private handleInvitation(message: string) {
    console.log('Recebendo convite/solicitação via MQTT:', message)
    
    try {
      const data = JSON.parse(message)
      
      // Criar objeto GroupInvitation a partir dos dados recebidos
      const invitation: GroupInvitation = {
        id: data.id,
        groupId: data.groupId,
        groupName: data.groupName,
        invitedBy: data.invitedBy,
        timestamp: new Date(data.timestamp)
      }
      
      console.log('Convite processado:', invitation)
      
      const invitations = this.invitationsSubject.value
      const exists = invitations.some((i) => i.id === invitation.id)
      
      if (!exists) {
        const updatedInvitations = [...invitations, invitation]
        console.log('Adicionando novo convite. Total antes:', invitations.length, 'Total depois:', updatedInvitations.length)
        this.invitationsSubject.next(updatedInvitations)
        this.saveInvitationsToStorage(updatedInvitations)
      } else {
        console.log('Convite já existe, não adicionando:', invitation.id)
      }
    } catch (error) {
      console.error('Erro ao processar convite:', error)
    }
  }

  private removeInvitation(invitationId: string) {
    const invitations = this.invitationsSubject.value.filter((i) => i.id !== invitationId)
    this.invitationsSubject.next(invitations)
    this.saveInvitationsToStorage(invitations)
  }

  clearInvitations() {
    console.log(`Limpando convites do usuário: ${this.currentUsername}`)
    this.invitationsSubject.next([])
    this.saveInvitationsToStorage([])
  }

  // Limpar notificações ao desconectar
  onDisconnect() {
    console.log(`Usuário ${this.currentUsername} desconectando - limpando notificações`)
    this.invitationsSubject.next([])
    // Não salvar no localStorage - manter os convites para quando reconectar
  }

  // Método para testar persistência (temporário para debug)
  testInvitePersistence() {
    const testInvitation: GroupInvitation = {
      id: 'test_inv_' + Date.now(),
      groupId: 'test_group',
      groupName: 'Grupo Teste',
      invitedBy: 'user_test',
      timestamp: new Date()
    }
    
    console.log('Testando persistência de convites...')
    const invitations = this.invitationsSubject.value
    const updatedInvitations = [...invitations, testInvitation]
    this.invitationsSubject.next(updatedInvitations)
    this.saveInvitationsToStorage(updatedInvitations)
    
    // Verificar se foi salvo
    setTimeout(() => {
      const saved = localStorage.getItem(this.STORAGE_KEY)
      console.log('Convites salvos no localStorage:', saved ? JSON.parse(saved).length + ' itens' : 'nenhum')
    }, 100)
  }

  private loadInvitationsFromStorage() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const invitations = JSON.parse(stored).map((inv: GroupInvitation & { timestamp: string }) => ({
          ...inv,
          timestamp: new Date(inv.timestamp)
        }))
        this.invitationsSubject.next(invitations)
        console.log('Convites carregados do localStorage:', invitations.length)
      }
    } catch (error) {
      console.error('Erro ao carregar convites do localStorage:', error)
    }
  }

  private saveInvitationsToStorage(invitations: GroupInvitation[]) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(invitations))
      console.log('Convites salvos no localStorage:', invitations.length)
    } catch (error) {
      console.error('Erro ao salvar convites no localStorage:', error)
    }
  }
}
