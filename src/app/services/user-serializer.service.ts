import { Injectable } from '@angular/core'
import { User } from '../models'

@Injectable({
  providedIn: 'root'
})
export class UserSerializerService {

  serializeUser(user: User): Record<string, unknown> {
    return {
      id: user.id,
      name: user.name,
      online: user.online,
      lastSeen: user.lastSeen?.toISOString()
    }
  }

  deserializeUser(userData: Record<string, unknown>): User {
    return new User(
      userData['id'] as string,
      userData['name'] as string,
      userData['online'] !== undefined ? userData['online'] as boolean : true,
      userData['lastSeen'] ? new Date(userData['lastSeen'] as string) : new Date()
    )
  }

  serializeUsers(users: User[]): Record<string, unknown>[] {
    return users.map(user => this.serializeUser(user))
  }

  deserializeUsers(usersData: Record<string, unknown>[]): User[] {
    return usersData.map(userData => this.deserializeUser(userData))
  }

  createUserFromMqttData(userData: Record<string, unknown>): User {
    return new User(
      (userData['id'] || userData) as string,
      (userData['name'] || userData) as string,
      userData['online'] !== undefined ? userData['online'] as boolean : true,
      userData['lastSeen'] ? new Date(userData['lastSeen'] as string) : new Date()
    )
  }
}
