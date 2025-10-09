import { ChatType } from "./chat-type.component"
import { Group } from "./group.model" // Ajuste o caminho conforme sua estrutura
import { User } from "./user.model" // Ajuste o caminho conforme sua estrutura

export class SelectedChat {
  constructor(
    public type: ChatType,
    public id: string,
    public name: string,
    public group?: Group 
  ) {}

  isUser(): boolean {
    return this.type === ChatType.User
  }

  isGroup(): boolean {
    return this.type === ChatType.Group
  }

  getMembers(): User[] {
    if (this.isGroup() && this.group) {
      return this.group.members || []
    }
    return []
  }

  getMembersCount(): number {
    return this.getMembers().length
  }

  isGroupLeader(user: User): boolean {
    if (this.isGroup() && this.group) {
      return this.group.leader.id === user.id
    }
    return false
  }
}