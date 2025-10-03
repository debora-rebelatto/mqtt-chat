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

  constructor(private mqttService: MqttService) {}

  initialize(username: string) {
    this.mqttService.subscribe(`meu-chat-mqtt/invitations/${username}`, (message) => {
      this.handleInvitation(message)
    })

    this.mqttService.subscribe('meu-chat-mqtt/invitations/responses', (message) => {})
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
    const invitation: GroupInvitation = JSON.parse(message)
    const invitations = this.invitationsSubject.value

    const exists = invitations.some((i) => i.id === invitation.id)
    if (!exists) {
      this.invitationsSubject.next([...invitations, invitation])
    }
  }

  private removeInvitation(invitationId: string) {
    const invitations = this.invitationsSubject.value.filter((i) => i.id !== invitationId)
    this.invitationsSubject.next(invitations)
  }

  clearInvitations() {
    this.invitationsSubject.next([])
  }
}
