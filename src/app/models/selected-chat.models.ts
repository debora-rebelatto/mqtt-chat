import { ChatType } from "./chat-type.component"
import { Group } from "./group.model"
import { User } from "./user.model"

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
}