import { ChatType } from "./chat-type.component"

export class SelectedChat {
  constructor(
    public type: ChatType,
    public id: string,
    public name: string
  ) {}

  isUser(): boolean {
    return this.type === ChatType.User
  }

  isGroup(): boolean {
    return this.type === ChatType.Group
  }
}
