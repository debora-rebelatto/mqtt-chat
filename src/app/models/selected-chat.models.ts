export class SelectedChat {
  type: 'user' | 'group'
  id: string
  name: string

  constructor(type: 'user' | 'group', id: string, name: string) {
    this.type = type
    this.id = id
    this.name = name
  }

  isUser(): boolean {
    return this.type === 'user'
  }

  isGroup(): boolean {
    return this.type === 'group'
  }
}
