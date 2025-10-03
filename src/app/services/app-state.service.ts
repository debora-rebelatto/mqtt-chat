import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { SelectedChat } from '../models/selected-chat.models'

@Injectable({
  providedIn: 'root'
})
export class AppStateService {
  private usernameSubject = new BehaviorSubject<string>('')
  private connectedSubject = new BehaviorSubject<boolean>(false)
  private selectedChatSubject = new BehaviorSubject<SelectedChat | null>(null)

  public username$ = this.usernameSubject.asObservable()
  public connected$ = this.connectedSubject.asObservable()
  public selectedChat$ = this.selectedChatSubject.asObservable()

  get username(): string {
    return this.usernameSubject.value
  }

  get connected(): boolean {
    return this.connectedSubject.value
  }

  get selectedChat(): SelectedChat | null {
    return this.selectedChatSubject.value
  }

  setUsername(username: string) {
    this.usernameSubject.next(username)
  }

  setConnected(connected: boolean) {
    this.connectedSubject.next(connected)
  }

  setSelectedChat(chat: SelectedChat | null) {
    this.selectedChatSubject.next(chat)
  }

  selectChat(type: 'user' | 'group', id: string, name: string) {
    this.setSelectedChat(new SelectedChat(type, id, name))
  }

  isSelectedChat(type: 'user' | 'group', id: string): boolean {
    const selected = this.selectedChat
    return selected?.type === type && selected?.id === id
  }
}
