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

  constructor(private mqttService: MqttService) {}

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
    this.groupsSubject.next([...currentGroups, newGroup])

    return newGroup
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
    }
  }
}
