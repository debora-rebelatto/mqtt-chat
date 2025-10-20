import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { MqttTopics } from '../config/mqtt-topics'
import { Group, User } from '../models'
import { IdGeneratorService } from './id-generator.service'
import { MqttService } from './mqtt.service'

@Injectable({
  providedIn: 'root'
})
export class GroupService {
  private groupsSubject = new BehaviorSubject<Group[]>([])
  public groups$ = this.groupsSubject.asObservable()
  private currentUser!: User
  private processedMessages = new Set<string>()
  private isInitialized = false

  constructor(
    private mqttService: MqttService,
    private idGeneratorService: IdGeneratorService
  ) {}

  setCurrentUser(user: User): void {
    this.currentUser = user
  }

  getGroups(): Group[] {
    return this.groupsSubject.value
  }

  initialize(): void {
    if (this.isInitialized) {
      return
    }

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
    this.isInitialized = true
  }

  createGroup(name: string, leader: User): Group {
    const groupId = this.idGeneratorService.generateId('group_')
    const newGroup = new Group(groupId, name, leader, [leader], new Date())

    const currentGroups = this.groupsSubject.value
    const updatedGroups = [...currentGroups, newGroup]
    this.groupsSubject.next(updatedGroups)
    this.updateGroup(newGroup)

    return newGroup
  }

  updateGroup(group: Group): void {
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

  addMemberToGroup(groupId: string, user: User): boolean {
    const groups = this.groupsSubject.value
    const groupIndex = groups.findIndex((g) => g.id === groupId)

    if (groupIndex === -1) {
      console.error(`Grupo ${groupId} não encontrado`)
      return false
    }

    const group = groups[groupIndex]

    const memberExists = group.members.some((member) => member.id === user.id)
    if (memberExists) {
      return false
    }

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

    return true
  }

  private requestGroups(): void {
    this.mqttService.publish(MqttTopics.groupList, 'REQUEST_GROUPS')
  }

  private handleGroupMessage(message: string): void {
    if (message === 'REQUEST_GROUPS') return

    const groupData = JSON.parse(message)

    if (groupData.id && groupData.name && groupData.leader && groupData.members) {
      const leader = new User(
        groupData.leader.id || groupData.leader,
        groupData.leader.name || groupData.leader,
        groupData.leader.online !== undefined ? groupData.leader.online : true,
        groupData.leader.lastSeen ? new Date(groupData.leader.lastSeen) : new Date()
      )

      const memberMap = new Map<string, User>()
      groupData.members.forEach((memberData: User) => {
        const user = new User(
          memberData.id,
          memberData.name,
          memberData.online !== undefined ? memberData.online : true,
          memberData.lastSeen ? new Date(memberData.lastSeen) : new Date()
        )
        if (!memberMap.has(user.id)) {
          memberMap.set(user.id, user)
        }
      })

      const members = Array.from(memberMap.values())

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

  private handleInvitationResponse(message: string): void {
    const response = JSON.parse(message)

    if (response.type !== 'invitation_response') {
      return
    }

    const group = this.groupsSubject.value.find((g) => g.id === response.groupId)
    if (!group) {
      return
    }

    if (group.leader.id !== this.currentUser.id) {
      return
    }
  }

  private handleGroupUpdate(message: string): void {
    const update = JSON.parse(message)

    const messageKey = `${update.type}_${update.invitationId || update.groupId}_${update.timestamp}`

    if (this.processedMessages.has(messageKey)) {
      return
    }

    this.processedMessages.add(messageKey)

    if (this.processedMessages.size > 1000) {
      const first = this.processedMessages.values().next().value
      if (first) {
        this.processedMessages.delete(first)
      }
    }

    if (update.type === 'member_added') {
      this.handleMemberAdded(update)
    }
  }

  private handleMemberAdded(update: any): void {
    const group = this.getGroupById(update.groupId)

    if (!group) {
      return
    }

    const memberExists = group.members.some((m) => m.id === update.invitee)

    if (memberExists) {
      return
    }

    const userToAdd = new User(update.invitee, update.invitee)
    this.addMemberToGroup(update.groupId, userToAdd)
  }

  getGroupById(groupId: string): Group | undefined {
    return this.groupsSubject.value.find((g) => g.id === groupId)
  }
}
