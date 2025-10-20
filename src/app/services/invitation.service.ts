import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { MqttService } from './mqtt.service'
import { GroupInvitation } from '../models/group-invitation.model'
import { Group, User } from '../models'
import { MqttTopics } from '../config/mqtt-topics'
import { AppStateService } from './app-state.service'
import { IdGeneratorService } from './id-generator.service'

@Injectable({
  providedIn: 'root'
})
export class InvitationService {
  private invitationsSubject = new BehaviorSubject<GroupInvitation[]>([])
  public invitations$ = this.invitationsSubject.asObservable()
  private currentUser!: User
  private pendingRequests = new Set<string>()
  private processedInvitations = new Set<string>() // Prevenir duplicatas

  constructor(
    private mqttService: MqttService,
    private appState: AppStateService,
    private idGenerator: IdGeneratorService
  ) {}

  initialize(): void {
    this.currentUser = this.appState.user!

    this.mqttService.subscribe(MqttTopics.sendInvitation(this.currentUser.id), (message) => {
      this.handleInvitation(message)
    })

    this.mqttService.subscribe(MqttTopics.invitationResponses, (message) => {
      console.log('Resposta de convite recebida:', message)
    })
  }

  requestJoinGroup(group: Group): boolean {
    const requesterId = this.currentUser.id
    const requestKey = `${requesterId}_${group.id}`

    if (this.pendingRequests.has(requestKey)) {
      console.warn('Requisição já pendente para este grupo')
      return false
    }

    if (!group.leader || !group.leader.id) {
      console.error('Grupo sem líder definido')
      return false
    }

    const invitationId = this.idGenerator.generateId('req_')
    const joinRequest = new GroupInvitation(
      invitationId,
      group.id,
      group.name,
      requesterId,
      new Date()
    )

    const payload = {
      ...joinRequest,
      invitee: requesterId,
      type: 'join_request'
    }

    this.pendingRequests.add(requestKey)
    this.mqttService.publish(MqttTopics.sendInvitation(group.leader.id), JSON.stringify(payload))

    return true
  }

  acceptInvitation(invitation: GroupInvitation): void {
    // Prevenir processamento múltiplo
    const processKey = `accept_${invitation.id}`
    if (this.processedInvitations.has(processKey)) {
      console.warn('Convite já processado:', invitation.id)
      return
    }
    this.processedInvitations.add(processKey)

    // Publicar apenas no tópico de atualizações de grupo
    // O GroupService deve ser o único responsável por processar member_added
    const response = {
      type: 'member_added',
      invitationId: invitation.id,
      groupId: invitation.groupId,
      invitee: invitation.invitee,
      accepted: true,
      timestamp: new Date().toISOString()
    }

    // Publicar APENAS em groupUpdates
    this.mqttService.publish(MqttTopics.groupUpdates, JSON.stringify(response))

    // Notificar o solicitante sobre a aceitação (opcional)
    const notificationResponse = {
      type: 'invitation_response',
      invitationId: invitation.id,
      groupId: invitation.groupId,
      accepted: true,
      timestamp: new Date().toISOString()
    }
    this.mqttService.publish(MqttTopics.invitationResponses, JSON.stringify(notificationResponse))

    // Remover da lista local
    this.removeInvitation(invitation.id)

    // Limpar requisição pendente
    const requestKey = `${invitation.invitee}_${invitation.groupId}`
    this.pendingRequests.delete(requestKey)

    // Limpar da lista de processados após um tempo
    setTimeout(() => {
      this.processedInvitations.delete(processKey)
    }, 5000)
  }

  rejectInvitation(invitation: GroupInvitation): void {
    // Prevenir processamento múltiplo
    const processKey = `reject_${invitation.id}`
    if (this.processedInvitations.has(processKey)) {
      console.warn('Convite já processado:', invitation.id)
      return
    }
    this.processedInvitations.add(processKey)

    const response = {
      type: 'invitation_response',
      invitationId: invitation.id,
      groupId: invitation.groupId,
      invitee: invitation.invitee,
      accepted: false,
      timestamp: new Date().toISOString()
    }

    this.mqttService.publish(MqttTopics.invitationResponses, JSON.stringify(response))
    this.removeInvitation(invitation.id)

    const requestKey = `${invitation.invitee}_${invitation.groupId}`
    this.pendingRequests.delete(requestKey)
  }

  private handleInvitation(message: string): void {
    const data = JSON.parse(message)

    if (this.processedInvitations.has(`received_${data.id}`)) {
      console.warn('Convite duplicado ignorado:', data.id)
      return
    }
    this.processedInvitations.add(`received_${data.id}`)

    const invitation = new GroupInvitation(
      data.id,
      data.groupId,
      data.groupName,
      data.invitee,
      new Date(data.timestamp)
    )

    const invitations = this.invitationsSubject.value
    const exists = invitations.some((i) => i.id === invitation.id)

    if (!exists) {
      const updatedInvitations = [...invitations, invitation]
      this.invitationsSubject.next(updatedInvitations)
      console.log('Novo convite recebido:', invitation.id)
    }

    // Limpar da lista de processados após um tempo
    setTimeout(() => {
      this.processedInvitations.delete(`received_${data.id}`)
    }, 60000) // 1 minuto
  }

  private removeInvitation(invitationId: string): void {
    const invitations = this.invitationsSubject.value.filter((i) => i.id !== invitationId)
    this.invitationsSubject.next(invitations)
  }

  onDisconnect(): void {
    this.invitationsSubject.next([])
    this.pendingRequests.clear()
    this.processedInvitations.clear()
  }
}

// ========================================
// NOTAS IMPORTANTES SOBRE A CORREÇÃO
// ========================================
/*
PROBLEMA IDENTIFICADO:
- acceptInvitation estava publicando em 2 tópicos (invitationResponses + groupUpdates)
- Ambos com type: 'member_added'
- Causando processamento duplicado no GroupService

SOLUÇÃO IMPLEMENTADA:
1. Separação de responsabilidades:
   - groupUpdates: type 'member_added' → GroupService adiciona membro
   - invitationResponses: type 'invitation_response' → Apenas notificação

2. Proteção contra duplicatas:
   - Set processedInvitations rastreia IDs já processados
   - Timeout de 5 segundos para limpar (previne reprocessamento imediato)
   - Previne cliques múltiplos e mensagens MQTT duplicadas

3. Logs melhorados:
   - Console.warn para duplicatas
   - Console.error para erros críticos
   - Facilita debug

VERIFICAR NO GroupService:
Certifique-se de que o GroupService processa apenas mensagens com:
- type === 'member_added'
- Vindo do tópico groupUpdates

Exemplo de handler no GroupService:
```typescript
if (data.type === 'member_added') {
  // Verificar se membro já existe antes de adicionar
  const group = this.getGroupById(data.groupId)
  if (group && !group.members.some(m => m.id === data.invitee)) {
    // Adicionar membro
  }
}
```
*/
