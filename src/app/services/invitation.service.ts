import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { MqttService } from './mqtt.service'
import { GroupInvitation } from '../models/group-invitation.model'
import { User } from '../models'

@Injectable({
  providedIn: 'root'
})
export class InvitationService {
  private invitationsSubject = new BehaviorSubject<GroupInvitation[]>([])
  public invitations$ = this.invitationsSubject.asObservable()
  private readonly STORAGE_KEY_BASE = 'mqtt-chat-invitations'
  private currentUser!: User
  private pendingRequests = new Set<string>()

  constructor(private mqttService: MqttService) {}

  initialize(user: User) {
    this.currentUser = user
    this.loadInvitationsFromStorage()

    this.mqttService.subscribe(`meu-chat-mqtt/invitations/${user.id}`, (message) => {
      this.handleInvitation(message)
    })

    this.mqttService.subscribe('meu-chat-mqtt/invitations/responses', (message) => {
      console.log(message)
    })
  }

  private get STORAGE_KEY(): string {
    return `${this.STORAGE_KEY_BASE}-${this.currentUser.id}`
  }

  sendInvitation(groupId: string, groupName: string, invitee: User) {
    const invitation = new GroupInvitation(
      `inv_${Date.now()}_${Math.random().toString(16).substring(2, 8)}`,
      groupId,
      groupName,
      invitee,
      new Date()
    )

    const payload = {
      ...invitation,
      invitee: {
        id: invitee.id,
        name: invitee.name,
        online: invitee.online,
        lastSeen: invitee.lastSeen
      }
    }

    this.mqttService.publish(`meu-chat-mqtt/invitations/${invitee.id}`, JSON.stringify(payload))
  }

  requestJoinGroup(groupId: string, groupName: string, requester: User, leader: User) {
    const requestKey = `${requester.id}_${groupId}`

    if (this.pendingRequests.has(requestKey)) {
      return false
    }

    const joinRequest = new GroupInvitation(
      `req_${Date.now()}_${Math.random().toString(16).substring(2, 8)}`,
      groupId,
      groupName,
      requester,
      new Date()
    )

    const payload = {
      ...joinRequest,
      invitee: {
        id: requester.id,
        name: requester.name,
        online: requester.online || true,
        lastSeen: requester.lastSeen || new Date()
      },
      leader: {
        id: leader.id,
        name: leader.name
      },
      type: 'join_request'
    }

    this.pendingRequests.add(requestKey)
    this.mqttService.publish(`meu-chat-mqtt/invitations/${leader.id}`, JSON.stringify(payload))

    return true
  }

  acceptInvitation(invitation: GroupInvitation) {
    const response = {
      invitationId: invitation.id,
      groupId: invitation.groupId,
      invitee: {
        id: invitation.invitee.id,
        name: invitation.invitee.name,
        online: invitation.invitee.online,
        lastSeen: invitation.invitee.lastSeen
      },
      accepted: true,
      timestamp: new Date()
    }

    console.log('Enviando resposta de aceitação:', response)
    this.mqttService.publish('meu-chat-mqtt/invitations/responses', JSON.stringify(response))
    this.removeInvitation(invitation.id)

    const requestKey = `${invitation.invitee.id}_${invitation.groupId}`
    this.pendingRequests.delete(requestKey)
  }

  rejectInvitation(invitation: GroupInvitation) {
    const response = {
      invitationId: invitation.id,
      groupId: invitation.groupId,
      invitee: invitation.invitee,
      accepted: false,
      timestamp: new Date()
    }

    this.mqttService.publish('meu-chat-mqtt/invitations/responses', JSON.stringify(response))
    this.removeInvitation(invitation.id)

    const requestKey = `${invitation.invitee.id}_${invitation.groupId}`
    this.pendingRequests.delete(requestKey)
  }

  private handleInvitation(message: string) {
    console.log('Recebendo convite/solicitação:', message)
    const data = JSON.parse(message)

    const invitee = new User(
      data.invitee.id,
      data.invitee.name,
      data.invitee.online,
      new Date(data.invitee.lastSeen)
    )

    const invitation = new GroupInvitation(
      data.id,
      data.groupId,
      data.groupName,
      invitee,
      new Date(data.timestamp)
    )

    const invitations = this.invitationsSubject.value
    const exists = invitations.some((i) => i.id === invitation.id)

    if (!exists) {
      console.log('Adicionando novo convite:', invitation)
      const updatedInvitations = [...invitations, invitation]
      this.invitationsSubject.next(updatedInvitations)
      this.saveInvitationsToStorage(updatedInvitations)
    } else {
      console.log('Convite já existe, ignorando')
    }
  }

  private removeInvitation(invitationId: string) {
    const invitations = this.invitationsSubject.value.filter((i) => i.id !== invitationId)
    this.invitationsSubject.next(invitations)
    this.saveInvitationsToStorage(invitations)
  }

  clearInvitations() {
    this.invitationsSubject.next([])
    this.saveInvitationsToStorage([])
    this.pendingRequests.clear()
  }

  hasPendingRequest(groupId: string): boolean {
    const requestKey = `${this.currentUser.id}_${groupId}`
    return this.pendingRequests.has(requestKey)
  }

  onDisconnect() {
    this.invitationsSubject.next([])
  }

  private loadInvitationsFromStorage() {
    const stored = localStorage.getItem(this.STORAGE_KEY)
    if (stored) {
      const invitationsData = JSON.parse(stored)
      const invitations = invitationsData.map((invData: any) => {
        const invitee = new User(
          invData.invitee.id,
          invData.invitee.name,
          invData.invitee.online,
          new Date(invData.invitee.lastSeen)
        )
        return new GroupInvitation(
          invData.id,
          invData.groupId,
          invData.groupName,
          invitee,
          new Date(invData.timestamp)
        )
      })
      this.invitationsSubject.next(invitations)
    }
  }

  private saveInvitationsToStorage(invitations: GroupInvitation[]) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(invitations))
  }
}
