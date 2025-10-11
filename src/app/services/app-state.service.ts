import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { SelectedChat } from '../models/selected-chat.models'
import { ChatType, User } from '../models'

@Injectable({
  providedIn: 'root'
})
export class AppStateService {
  private userSubject = new BehaviorSubject<User | null>(null)
  private connectedSubject = new BehaviorSubject<boolean>(false)
  private selectedChatSubject = new BehaviorSubject<SelectedChat | null>(null)

  private readonly SELECTED_CHAT_KEY = 'mqtt-chat-selected-chat'

  public user$ = this.userSubject.asObservable()
  public connected$ = this.connectedSubject.asObservable()
  public selectedChat$ = this.selectedChatSubject.asObservable()

  constructor() {
    this.loadSelectedChatFromStorage()
  }

  get user(): User | null {
    return this.userSubject.value
  }

  get connected(): boolean {
    return this.connectedSubject.value
  }

  get selectedChat(): SelectedChat | null {
    return this.selectedChatSubject.value
  }

  setUser(user: User | null) {
    this.userSubject.next(user)
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

  isSelectedChat(type: ChatType, id: string): boolean {
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
