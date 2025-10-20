import { Injectable } from '@angular/core'
import { BehaviorSubject, map } from 'rxjs'
import { MqttService } from './mqtt.service'
import { GroupInvitation } from '../models/group-invitation.model'
import { Group, User, NotificationStatus } from '../models'
import { MqttTopics } from '../config/mqtt-topics'
import { AppStateService } from './app-state.service'
import { IdGeneratorService } from './id-generator.service'

@Injectable({
  providedIn: 'root'
})
export class InvitationService {
  private invitationsSubject = new BehaviorSubject<GroupInvitation[]>([])
  public invitations$ = this.invitationsSubject.asObservable()

  public pendingInvitations$ = this.invitations$.pipe(
    map((invitations) => invitations.filter((inv) => inv.status?.isPending))
  )

  public acceptedInvitations$ = this.invitations$.pipe(
    map((invitations) => invitations.filter((inv) => inv.status?.isAccepted))
  )

  public rejectedInvitations$ = this.invitations$.pipe(
    map((invitations) => invitations.filter((inv) => inv.status?.isRejected))
  )

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

    this.requestPendingInvitations()

    this.mqttService.subscribe(MqttTopics.sendInvitation(this.currentUser.id), (message) => {
      this.handleInvitation(message)
    })

    this.mqttService.subscribe(MqttTopics.invitationResponses, (message) => {
      this.handleInvitationResponse(message)
    })

    this.mqttService.subscribe(MqttTopics.pendingSync(this.currentUser.id), (message) => {
      this.handlePendingInvitations(message)
    })
  }

  private requestPendingInvitations() {
    const request = {
      type: 'pending_invitations_request',
      userId: this.currentUser.id,
      timestamp: new Date().toISOString()
    }

    this.mqttService.publish(
      MqttTopics.pendingSync(this.currentUser.id),
      JSON.stringify(request),
      true,
      1
    )
  }

  private handlePendingInvitations(message: string) {
    const data = JSON.parse(message)

    if (data.type === 'pending_invitations' && data.forUserId === this.currentUser.id) {
      data.invitations?.forEach((invitationData: any) => {
        const exists = this.invitationsSubject.value.some((inv) => inv.id === invitationData.id)

        if (!exists) {
          const inviteeUser = new User(
            invitationData.invitee.id || invitationData.invitee,
            invitationData.invitee.name || 'Unknown User'
          )

          const status = invitationData.status?.id
            ? NotificationStatus.fromValue(invitationData.status.id)
            : NotificationStatus.pending

          const invitation = new GroupInvitation(
            invitationData.id,
            invitationData.groupId,
            invitationData.groupName,
            inviteeUser,
            new Date(invitationData.timestamp),
            status
          )
          this.addInvitation(invitation)
        }
      })
    }
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
      this.currentUser,
      new Date(),
      NotificationStatus.pending
    )

    const payload = {
      id: invitationId,
      groupId: group.id,
      groupName: group.name,
      invitee: {
        id: this.currentUser.id,
        name: this.currentUser.name
      },
      type: 'join_request',
      status: NotificationStatus.pending,
      timestamp: new Date().toISOString()
    }

    this.pendingRequests.add(requestKey)

    this.addInvitation(joinRequest)

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
      invitee: {
        id: invitation.invitee.id,
        name: invitation.invitee.name
      },
      timestamp: new Date().toISOString(),
      status: NotificationStatus.accepted
    }

    this.mqttService.publish(MqttTopics.groupUpdates, JSON.stringify(response))

    this.updateInvitationStatus(invitation.id, NotificationStatus.accepted)

    const requestKey = `${invitation.invitee.id}_${invitation.groupId}`
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
      invitee: {
        id: invitation.invitee.id,
        name: invitation.invitee.name
      },
      accepted: false,
      timestamp: new Date().toISOString(),
      status: NotificationStatus.rejected
    }

    this.mqttService.publish(MqttTopics.invitationResponses, JSON.stringify(response))

    this.updateInvitationStatus(invitation.id, NotificationStatus.rejected)

    const requestKey = `${invitation.invitee.id}_${invitation.groupId}`
    this.pendingRequests.delete(requestKey)
  }

  private handleInvitation(message: string): void {
    const data = JSON.parse(message)

    if (this.processedInvitations.has(`received_${data.id}`)) {
      return
    }
    this.processedInvitations.add(`received_${data.id}`)

    const inviteeUser = new User(
      data.invitee.id || data.invitee,
      data.invitee.name || 'Unknown User'
    )

    const status = data.status?.id
      ? NotificationStatus.fromValue(data.status.id)
      : NotificationStatus.pending

    const invitation = new GroupInvitation(
      data.id,
      data.groupId,
      data.groupName,
      inviteeUser,
      new Date(data.timestamp),
      status
    )

    this.addInvitation(invitation)

    setTimeout(() => {
      this.processedInvitations.delete(`received_${data.id}`)
    }, 60000)
  }

  private handleInvitationResponse(message: string): void {
    const data = JSON.parse(message)

    if (data.type === 'invitation_response' || data.type === 'member_added') {
      const invitationId = data.invitationId

      if (data.accepted === false || data.status?.isRejected) {
        this.updateInvitationStatus(invitationId, NotificationStatus.rejected)
      } else if (data.accepted === true || data.status?.isAccepted) {
        this.updateInvitationStatus(invitationId, NotificationStatus.accepted)
      }
    }
  }

  private addInvitation(invitation: GroupInvitation): void {
    const invitations = this.invitationsSubject.value
    const exists = invitations.some((i) => i.id === invitation.id)

    if (!exists) {
      const updatedInvitations = [...invitations, invitation]
      this.invitationsSubject.next(updatedInvitations)
    }
  }

  private updateInvitationStatus(invitationId: string, status: NotificationStatus): void {
    const invitations = this.invitationsSubject.value.map((inv) =>
      inv.id === invitationId ? { ...inv, status: status, timestamp: new Date() } : inv
    )
    this.invitationsSubject.next(invitations)
  }

  onDisconnect(): void {
    this.pendingRequests.clear()
    this.processedInvitations.clear()
  }
}
