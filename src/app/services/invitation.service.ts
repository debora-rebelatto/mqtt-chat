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

  constructor(private mqttService: MqttService) {}

  initialize(username: string) {
    this.currentUsername = username
    this.loadInvitationsFromStorage()

    this.mqttService.subscribe(`meu-chat-mqtt/invitations/${username}`, (message) => {
      this.handleInvitation(message)
    })

    this.mqttService.subscribe('meu-chat-mqtt/invitations/responses', (message) => {
      console.log(message)
    })
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

  requestJoinGroup(groupId: string, groupName: string, requester: string, leader: string) {
    const joinRequest: GroupInvitation = {
      id: `req_${Date.now()}_${Math.random().toString(16).substring(2, 8)}`,
      groupId: groupId,
      groupName: groupName,
      invitedBy: requester,
      timestamp: new Date()
    }

    const payload = {
      ...joinRequest,
      to: leader,
      type: 'join_request'
    }

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
    const data = JSON.parse(message)

    const invitation: GroupInvitation = {
      id: data.id,
      groupId: data.groupId,
      groupName: data.groupName,
      invitedBy: data.invitedBy,
      timestamp: new Date(data.timestamp)
    }

    const invitations = this.invitationsSubject.value
    const exists = invitations.some((i) => i.id === invitation.id)

    if (!exists) {
      const updatedInvitations = [...invitations, invitation]

      this.invitationsSubject.next(updatedInvitations)
      this.saveInvitationsToStorage(updatedInvitations)
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
  }

  onDisconnect() {
    this.invitationsSubject.next([])
  }

  testInvitePersistence() {
    const testInvitation: GroupInvitation = {
      id: 'test_inv_' + Date.now(),
      groupId: 'test_group',
      groupName: 'Grupo Teste',
      invitedBy: 'user_test',
      timestamp: new Date()
    }

    const invitations = this.invitationsSubject.value
    const updatedInvitations = [...invitations, testInvitation]
    this.invitationsSubject.next(updatedInvitations)
    this.saveInvitationsToStorage(updatedInvitations)

    setTimeout(() => {
      localStorage.getItem(this.STORAGE_KEY)
    }, 100)
  }

  private loadInvitationsFromStorage() {
    const stored = localStorage.getItem(this.STORAGE_KEY)
    if (stored) {
      const invitations = JSON.parse(stored).map(
        (inv: GroupInvitation & { timestamp: string }) => ({
          ...inv,
          timestamp: new Date(inv.timestamp)
        })
      )
      this.invitationsSubject.next(invitations)
    }
  }

  private saveInvitationsToStorage(invitations: GroupInvitation[]) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(invitations))
  }
}
