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

  constructor(private mqttService: MqttService) {
    this.loadGroupsFromStorage()
  }

  initialize() {
    this.mqttService.subscribe('meu-chat-mqtt/groups', (message) => {
      this.handleGroupMessage(message)
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
