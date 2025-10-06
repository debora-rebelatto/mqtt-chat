import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { Group } from '../models/group.model'
import { MqttService } from './mqtt.service'

@Injectable({
  providedIn: 'root'
})
export class GroupService {
  private groupsSubject = new BehaviorSubject<Group[]>([])
  public groups$ = this.groupsSubject.asObservable()
  private readonly STORAGE_KEY = 'mqtt-chat-groups'
  private currentUser: string = ''

  constructor(private mqttService: MqttService) {
    this.loadGroupsFromStorage()
  }

  setCurrentUser(username: string) {
    this.currentUser = username
  }

  initialize() {
    this.mqttService.subscribe('meu-chat-mqtt/groups', (message) => {
      this.handleGroupMessage(message)
    })
    
    // Subscription para respostas de convites (apenas líderes processam)
    this.mqttService.subscribe('meu-chat-mqtt/invitations/responses', (message) => {
      this.handleInvitationResponse(message)
    })
    
    this.requestGroups()
  }

  createGroup(name: string, leader: string) {
    const groupId = `group_${Date.now()}_${Math.random().toString(16).substring(2, 8)}`

    const newGroup: Group = {
      id: groupId,
      name: name,
      leader: leader,
      members: [leader],
      createdAt: new Date()
    }

    this.mqttService.publish('meu-chat-mqtt/groups', JSON.stringify(newGroup), true)

    const currentGroups = this.groupsSubject.value
    const updatedGroups = [...currentGroups, newGroup]
    this.groupsSubject.next(updatedGroups)
    this.saveGroupsToStorage(updatedGroups)

    return newGroup
  }

  updateGroup(group: Group) {
    this.mqttService.publish('meu-chat-mqtt/groups', JSON.stringify(group), true)
  }

  // Adicionar membro ao grupo (apenas líder pode fazer)
  addMemberToGroup(groupId: string, username: string, currentUser: string) {
    const groups = this.groupsSubject.value
    const group = groups.find(g => g.id === groupId)
    
    if (!group) {
      console.error('Grupo não encontrado:', groupId)
      return false
    }
    
    if (group.leader !== currentUser) {
      console.error('Apenas o líder pode adicionar membros ao grupo')
      return false
    }
    
    if (group.members.includes(username)) {
      console.log('Usuário já é membro do grupo:', username)
      return false
    }
    
    // Adicionar membro e atualizar grupo
    const updatedGroup = {
      ...group,
      members: [...group.members, username]
    }
    
    console.log(`Adicionando ${username} ao grupo ${group.name}`)
    this.updateGroup(updatedGroup)
    
    // Atualizar localmente também
    const updatedGroups = groups.map(g => g.id === groupId ? updatedGroup : g)
    this.groupsSubject.next(updatedGroups)
    this.saveGroupsToStorage(updatedGroups)
    
    return true
  }

  // Enviar convite para usuário (apenas líder pode fazer)
  inviteUserToGroup(groupId: string, username: string) {
    const group = this.groupsSubject.value.find(g => g.id === groupId)
    
    if (!group) {
      console.error('Grupo não encontrado:', groupId)
      return false
    }
    
    if (group.leader !== this.currentUser) {
      console.error('Apenas o líder pode enviar convites')
      return false
    }
    
    if (group.members.includes(username)) {
      console.log('Usuário já é membro do grupo:', username)
      return false
    }
    
    // Enviar convite via InvitationService seria ideal, mas como não temos acesso aqui,
    // vamos publicar diretamente no tópico de convites
    const invitation = {
      id: `inv_${Date.now()}_${Math.random().toString(16).substring(2, 8)}`,
      groupId: groupId,
      groupName: group.name,
      invitedBy: this.currentUser,
      timestamp: new Date(),
      to: username
    }
    
    console.log(`Enviando convite para ${username} entrar no grupo ${group.name}`)
    this.mqttService.publish(`meu-chat-mqtt/invitations/${username}`, JSON.stringify(invitation))
    
    return true
  }

  private requestGroups() {
    this.mqttService.publish('meu-chat-mqtt/groups', 'REQUEST_GROUPS')
  }

  private handleGroupMessage(message: string) {
    if (message === 'REQUEST_GROUPS') return

    const groupData = JSON.parse(message)

    if (groupData.id && groupData.name && groupData.leader && groupData.members) {
      const currentGroups = this.groupsSubject.value
      const existingIndex = currentGroups.findIndex((g) => g.id === groupData.id)

      let updatedGroups: Group[]
      if (existingIndex >= 0) {
        updatedGroups = [...currentGroups]
        updatedGroups[existingIndex] = groupData
      } else {
        updatedGroups = [...currentGroups, groupData]
      }

      this.groupsSubject.next(updatedGroups)
      this.saveGroupsToStorage(updatedGroups)
    }
  }

  // Processar respostas de convites (apenas líderes processam)
  private handleInvitationResponse(message: string) {
    try {
      const response = JSON.parse(message)
      
      // Verificar se o usuário atual é líder do grupo
      const group = this.groupsSubject.value.find(g => g.id === response.groupId)
      if (!group || group.leader !== this.currentUser) {
        // Não processar se não for o líder do grupo
        return
      }
      
      if (response.accepted) {
        console.log('Convite aceito pelo líder:', response)
        // Adicionar usuário ao grupo se o convite foi aceito
        this.addMemberToGroup(response.groupId, response.username, this.currentUser)
      } else {
        console.log('Convite rejeitado:', response)
      }
    } catch (error) {
      console.error('Erro ao processar resposta de convite:', error)
    }
  }

  private loadGroupsFromStorage() {
    const stored = localStorage.getItem(this.STORAGE_KEY)
    if (stored) {
      const groups = JSON.parse(stored).map((group: Group & { createdAt: string }) => ({
        ...group,
        createdAt: new Date(group.createdAt)
      }))
      this.groupsSubject.next(groups)
    }
  }

  private saveGroupsToStorage(groups: Group[]) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(groups))
  }
}
