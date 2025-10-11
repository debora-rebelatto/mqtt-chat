import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { MqttService } from './mqtt.service'
import { GroupInvitation } from '../models/group-invitation.model'
import { User } from '../models'
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

  constructor(
    private mqttService: MqttService,
    private appState: AppStateService,
    private idGenerator: IdGeneratorService
  ) {}

  initialize() {
    this.currentUser = this.appState.user!

    this.mqttService.subscribe(MqttTopics.sendInvitation(this.currentUser.id), (message) => {
      this.handleInvitation(message)
    })

    this.mqttService.subscribe(MqttTopics.invitationResponses, (message) => {
      console.log(message)
    })
  }

  requestJoinGroup(groupId: string, groupName: string, requester: User, leader: User) {
    const requestKey = `${requester.id}_${groupId}`

    if (this.pendingRequests.has(requestKey)) {
      return false
    }

    const invitationId = this.idGenerator.generateRequestId()
    const joinRequest = new GroupInvitation(invitationId, groupId, groupName, requester, new Date())

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
    this.mqttService.publish(MqttTopics.sendInvitation(leader.id), JSON.stringify(payload))

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

    this.mqttService.publish(MqttTopics.invitationResponses, JSON.stringify(response))
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

    this.mqttService.publish(MqttTopics.invitationResponses, JSON.stringify(response))
    this.removeInvitation(invitation.id)

    const requestKey = `${invitation.invitee.id}_${invitation.groupId}`
    this.pendingRequests.delete(requestKey)
  }

  private handleInvitation(message: string) {
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
      const updatedInvitations = [...invitations, invitation]
      this.invitationsSubject.next(updatedInvitations)
    }
  }

  private removeInvitation(invitationId: string) {
    const invitations = this.invitationsSubject.value.filter((i) => i.id !== invitationId)
    this.invitationsSubject.next(invitations)
  }

  clearInvitations() {
    this.invitationsSubject.next([])
    this.pendingRequests.clear()
  }

  hasPendingRequest(groupId: string): boolean {
    const requestKey = `${this.currentUser.id}_${groupId}`
    return this.pendingRequests.has(requestKey)
  }

  onDisconnect() {
    this.invitationsSubject.next([])
  }
}
