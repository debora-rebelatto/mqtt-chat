import { IdGeneratorService } from './id-generator.service'
import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { Group } from '../models/group.model'
import { User } from '../models/user.model'
import { MqttService } from './mqtt.service'
import { MqttTopics } from '../config/mqtt-topics'

@Injectable({
  providedIn: 'root'
})
export class GroupService {
  private groupsSubject = new BehaviorSubject<Group[]>([])
  public groups$ = this.groupsSubject.asObservable()
  private currentUser!: User
  private processedMessages = new Set<string>()

  constructor(
    private mqttService: MqttService,
    private idGeneratorService: IdGeneratorService
  ) {}

  setCurrentUser(user: User) {
    this.currentUser = user

    if (user) {
      this.mqttService.subscribe(MqttTopics.groupUpdates, (message) => {
        this.handleGroupUpdate(message)
      })
    }
  }

  getGroups(): Group[] {
    return this.groupsSubject.value
  }

  initialize() {
    this.mqttService.subscribe(MqttTopics.groupList, (message) => {
      this.handleGroupMessage(message)
    })

    this.mqttService.subscribe(MqttTopics.invitationResponses, (message) => {
      this.handleInvitationResponse(message)
    })

    this.mqttService.subscribe(MqttTopics.groupUpdates, (message) => {
      this.handleGroupUpdate(message)
    })

    this.requestGroups()
  }

  createGroup(name: string, leader: User) {
    const groupId = `group_${Date.now()}_${Math.random().toString(16).substring(2, 8)}`

    const newGroup = new Group(groupId, name, leader, [leader], new Date())

    const currentGroups = this.groupsSubject.value
    const updatedGroups = [...currentGroups, newGroup]
    this.groupsSubject.next(updatedGroups)
    this.updateGroup(newGroup)

    return newGroup
  }

  updateGroup(group: Group) {
    const groupForMqtt = {
      ...group,
      members: group.members.map((member) => ({
        id: member.id,
        name: member.name,
        online: member.online,
        lastSeen: member.lastSeen
      }))
    }

    this.mqttService.publish(MqttTopics.groupList, JSON.stringify(groupForMqtt), true)
  }

  addMemberToGroup(groupId: string, user: User) {
    const groups = this.groupsSubject.value
    const groupIndex = groups.findIndex((g) => g.id === groupId)

    if (groupIndex === -1) {
      console.error(`Group ${groupId} not found`)
      return false
    }

    const group = groups[groupIndex]

    const updatedGroup = new Group(
      group.id,
      group.name,
      group.leader,
      [...group.members, user],
      group.createdAt,
      group.unread
    )

    const updatedGroups = [...groups]
    updatedGroups[groupIndex] = updatedGroup

    this.groupsSubject.next(updatedGroups)
    this.updateGroup(updatedGroup)

    this.mqttService.publish(MqttTopics.groupList, JSON.stringify(updatedGroup), true)

    return true
  }

  inviteUserToGroup(groupId: string, username: string) {
    const group = this.groupsSubject.value.find((g) => g.id === groupId)

    if (!group) {
      return false
    }

    if (group.leader.id !== this.currentUser.id) {
      return false
    }

    if (group.members.some((member) => member.id === username)) {
      return false
    }

    const invitationId = this.idGeneratorService.generateInvitationId()

    const invitation = {
      id: invitationId,
      groupId: groupId,
      groupName: group.name,
      invitedBy: this.currentUser,
      timestamp: new Date(),
      to: username
    }

    this.mqttService.publish(MqttTopics.sendInvitation(username), JSON.stringify(invitation))

    return true
  }

  private requestGroups() {
    this.mqttService.publish(MqttTopics.groupList, 'REQUEST_GROUPS')
  }

  private handleGroupMessage(message: string) {
    if (message === 'REQUEST_GROUPS') return

    const groupData = JSON.parse(message)

    if (groupData.id && groupData.name && groupData.leader && groupData.members) {
      const leader = new User(
        groupData.leader.id || groupData.leader,
        groupData.leader.name || groupData.leader,
        groupData.leader.online !== undefined ? groupData.leader.online : true,
        groupData.leader.lastSeen ? new Date(groupData.leader.lastSeen) : new Date()
      )

      const members = groupData.members.map(
        (memberData: User) =>
          new User(
            memberData.id,
            memberData.name,
            memberData.online !== undefined ? memberData.online : true,
            memberData.lastSeen ? new Date(memberData.lastSeen) : new Date()
          )
      )

      const normalizedGroup = new Group(
        groupData.id,
        groupData.name,
        leader,
        members,
        new Date(groupData.createdAt),
        groupData.unread
      )

      const currentGroups = this.groupsSubject.value
      const existingIndex = currentGroups.findIndex((g) => g.id === normalizedGroup.id)

      let updatedGroups: Group[]
      if (existingIndex >= 0) {
        updatedGroups = [...currentGroups]
        updatedGroups[existingIndex] = normalizedGroup
      } else {
        updatedGroups = [...currentGroups, normalizedGroup]
      }

      this.groupsSubject.next(updatedGroups)
    }
  }

  private handleInvitationResponse(message: string) {
    const response = JSON.parse(message)

    const group = this.groupsSubject.value.find((g) => g.id === response.groupId)
    if (!group) {
      return
    }

    if (group.leader.id !== this.currentUser.id) {
      return
    }

    if (response.accepted) {
      const userToAdd = new User(response.invitee, response.invitee)

      const success = this.addMemberToGroup(response.groupId, userToAdd)

      if (success) {
        const payload = {
          type: 'member_added',
          groupId: response.groupId,
          timestamp: new Date()
        }

        this.mqttService.publish(MqttTopics.groupUpdates, JSON.stringify(payload))
      }
    }
  }

  private handleGroupUpdate(message: string) {
    const update = JSON.parse(message)

    const messageKey = `${update.type}_${update.invitationId}_${update.timestamp}`
    if (this.processedMessages.has(messageKey)) {
      return
    }

    this.processedMessages.add(messageKey)
    if (this.processedMessages.size > 100) {
      const first = this.processedMessages.values().next().value
      this.processedMessages.delete(first!)
    }

    if (update.type === 'member_added' && update.accepted === true) {
      const userToAdd = new User(update.invitee, update.invitee)

      this.addMemberToGroup(update.groupId, userToAdd)
    }
  }

  getGroupById(groupId: string): Group | undefined {
    return this.groupsSubject.value.find(g => g.id === groupId);
  }

  getGroupMembers(groupId: string): User[] {
    const group = this.getGroupById(groupId);
    return group ? group.members : [];
  }

  refreshGroups(): void {
    this.mqttService.publish('meu-chat-mqtt/groups', 'REQUEST_GROUPS');
  }

  getGroupDataForModal(groupId: string): { group: Group | undefined, members: User[] } {
    const group = this.getGroupById(groupId);
    return {
      group: group,
      members: group ? group.members : []
    };
  }
}
