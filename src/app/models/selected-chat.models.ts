export type ChatType = 'user' | 'group'

export class SelectedChat {
  constructor(
    public type: ChatType,
    public id: string,
    public name: string
  ) {}

  isUser(): boolean {
    return this.type === 'user'
  }

  isGroup(): boolean {
    return this.type === 'group'
  }
}
