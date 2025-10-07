import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { Group } from '../models/group.model'
import { User } from '../models/user.model'
import { MqttService } from './mqtt.service'

@Injectable({
  providedIn: 'root'
})
export class GroupService {
  private groupsSubject = new BehaviorSubject<Group[]>([])
  public groups$ = this.groupsSubject.asObservable()
  private readonly STORAGE_KEY = 'mqtt-chat-groups'
  private currentUser!: User

  constructor(private mqttService: MqttService) {
    this.loadGroupsFromStorage()
  }

  setCurrentUser(user: User) {
    this.currentUser = user

    if (user) {
      this.mqttService.subscribe(`meu-chat-mqtt/group-updates/${user.id}`, (message) => {
        this.handleGroupUpdate(message)
      })
    }
  }

  getGroups(): Group[] {
    return this.groupsSubject.value
  }

  initialize() {
    this.mqttService.subscribe('meu-chat-mqtt/groups', (message) => {
      this.handleGroupMessage(message)
    })

    this.mqttService.subscribe('meu-chat-mqtt/invitations/responses', (message) => {
      this.handleInvitationResponse(message)
    })

    this.requestGroups()
  }

  createGroup(name: string, leader: User) {
    const groupId = `group_${Date.now()}_${Math.random().toString(16).substring(2, 8)}`

    const newGroup = new Group(groupId, name, leader, [leader], new Date())

    this.updateGroup(newGroup)

    const currentGroups = this.groupsSubject.value
    const updatedGroups = [...currentGroups, newGroup]
    this.groupsSubject.next(updatedGroups)
    this.saveGroupsToStorage(updatedGroups)

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
    this.mqttService.publish('meu-chat-mqtt/groups', JSON.stringify(groupForMqtt), true)
  }

  addMemberToGroup(groupId: string, user: User, currentUser: User) {
    const groups = this.groupsSubject.value
    const group = groups.find((g) => g.id === groupId)

    if (!group) {
      return false
    }

    if (group.leader.id !== currentUser.id) {
      return false
    }

    if (group.members.some((member) => member.id === user.id)) {      this.updateGroup(group)
      return true
    }

    const updatedGroup = new Group(
      group.id,
      group.name,
      group.leader,
      [...group.members, user],
      group.createdAt,
      group.unread
    )

    const updatedGroups = groups.map((g) => (g.id === groupId ? updatedGroup : g))
    this.groupsSubject.next(updatedGroups)
    this.saveGroupsToStorage(updatedGroups)

    this.updateGroup(updatedGroup)

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

    const invitation = {
      id: `inv_${Date.now()}_${Math.random().toString(16).substring(2, 8)}`,
      groupId: groupId,
      groupName: group.name,
      invitedBy: this.currentUser,
      timestamp: new Date(),
      to: username
    }

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
      this.saveGroupsToStorage(updatedGroups)
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
      const userToAdd = new User(response.invitee.id, response.invitee.name, response.invitee.online, response.invitee.lastSeen)
      const currentUserObj = new User(this.currentUser.id, this.currentUser.name)

      const success = this.addMemberToGroup(response.groupId, userToAdd, currentUserObj)

      if (success) {
        this.mqttService.publish(
          `meu-chat-mqtt/group-updates/${response.invitee.id}`,
          JSON.stringify({
            type: 'member_added',
            groupId: response.groupId,
            timestamp: new Date()
          })
        )
      }
    }
  }

  private handleGroupUpdate(message: string) {
    const update = JSON.parse(message)

    if (update.type === 'member_added') {
      this.requestGroups()

      setTimeout(() => {
        this.requestGroups()
      }, 1000)
    }
  }

  private loadGroupsFromStorage() {
    const stored = localStorage.getItem(this.STORAGE_KEY)
    if (stored) {
      const groupsData = JSON.parse(stored)
      const groups = groupsData.map((groupData: Group) => {
        const leader = new User(groupData.leader.id, groupData.leader.name)

        const members = groupData.members.map(
          (memberData: User) => new User(memberData.id, memberData.name)
        )

        return new Group(
          groupData.id,
          groupData.name,
          leader,
          members,
          new Date(groupData.createdAt),
        )
      })
      this.groupsSubject.next(groups)
    }
  }

  private saveGroupsToStorage(groups: Group[]) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(groups))
  }
}
