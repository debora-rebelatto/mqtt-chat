import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { SelectedChat } from '../models/selected-chat.models'
import { ChatType } from '../models'

@Injectable({
  providedIn: 'root'
})
export class AppStateService {
  private usernameSubject = new BehaviorSubject<string>('')
  private connectedSubject = new BehaviorSubject<boolean>(false)
  private selectedChatSubject = new BehaviorSubject<SelectedChat | null>(null)

  private readonly SELECTED_CHAT_KEY = 'mqtt-chat-selected-chat'

  public username$ = this.usernameSubject.asObservable()
  public connected$ = this.connectedSubject.asObservable()
  public selectedChat$ = this.selectedChatSubject.asObservable()

  constructor() {
    this.loadSelectedChatFromStorage()
  }

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
    this.saveSelectedChatToStorage(chat)
  }

  selectChat(type: ChatType, id: string, name: string) {
    this.setSelectedChat(new SelectedChat(type, id, name))
  }

  isSelectedChat(type: 'user' | 'group', id: string): boolean {
    const selected = this.selectedChat
    return selected?.type === type && selected?.id === id
  }

  private loadSelectedChatFromStorage() {
    const stored = localStorage.getItem(this.SELECTED_CHAT_KEY)
    if (stored) {
      const chatData = JSON.parse(stored)
      const selectedChat = new SelectedChat(chatData.type, chatData.id, chatData.name)
      this.selectedChatSubject.next(selectedChat)
    }
  }

  private saveSelectedChatToStorage(chat: SelectedChat | null) {
    if (chat) {
      localStorage.setItem(
        this.SELECTED_CHAT_KEY,
        JSON.stringify({
          type: chat.type,
          id: chat.id,
          name: chat.name
        })
      )
    } else {
      localStorage.removeItem(this.SELECTED_CHAT_KEY)
    }
  }
}
