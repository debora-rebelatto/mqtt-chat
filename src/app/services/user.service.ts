import { Injectable } from '@angular/core'
import { User } from '../models/user.model'

@Injectable({ providedIn: 'root' })
export class MqttUserService {
  private users: Map<string, User> = new Map()

  addOrUpdateUser(user: User) {
    this.users.set(user.id, user)
  }

  getUsers(): User[] {
    return Array.from(this.users.values())
  }

  removeUser(userId: string) {
    this.users.delete(userId)
  }
}
