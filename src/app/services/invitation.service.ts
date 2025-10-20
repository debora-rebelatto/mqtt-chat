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
  private processedInvitations = new Set<string>()

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
      return false
    }

    if (!group.leader || !group.leader.id) {
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
    const processKey = `accept_${invitation.id}`
    if (this.processedInvitations.has(processKey)) {
      return
    }
    this.processedInvitations.add(processKey)

    const response = {
      type: 'member_added',
      invitationId: invitation.id,
      groupId: invitation.groupId,
      invitee: invitation.invitee,
      timestamp: new Date().toISOString()
    }

    this.mqttService.publish(MqttTopics.groupUpdates, JSON.stringify(response))

    this.removeInvitation(invitation.id)

    const requestKey = `${invitation.invitee}_${invitation.groupId}`
    this.pendingRequests.delete(requestKey)

    setTimeout(() => {
      this.processedInvitations.delete(processKey)
    }, 5000)
  }

  rejectInvitation(invitation: GroupInvitation): void {
    const processKey = `reject_${invitation.id}`
    if (this.processedInvitations.has(processKey)) {
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
    }

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
