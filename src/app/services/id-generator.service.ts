import { Injectable } from '@angular/core'

@Injectable({
  providedIn: 'root'
})
export class IdGeneratorService {
  
  generateId(prefix: string = 'id'): string {
    const timestamp = Date.now()
    const random = Math.random().toString(16).substring(2, 8)
    return `${prefix}_${timestamp}_${random}`
  }

  generateGroupId(): string {
    return this.generateId('group')
  }

  generateInvitationId(): string {
    return this.generateId('inv')
  }

  generateRequestId(): string {
    return this.generateId('req')
  }

  generateMessageId(): string {
    return this.generateId('msg')
  }

  generateClientId(username: string): string {
    const random = Math.random().toString(16).substring(2, 8)
    return `chat_${username}_${random}`
  }
}
