import { Injectable } from '@angular/core'
import { BehaviorSubject, Observable } from 'rxjs'

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private translations: { [key: string]: string } = {}
  private currentLang = 'br'
  private translationsSubject = new BehaviorSubject<{ [key: string]: string }>({})
  private translationsLoaded = false

  private fallbackTranslations: { [key: string]: string } = {
    CHAT_TITLE: 'Chat MQTT',
    CONVERSATIONS: 'Conversas',
    SEARCH: 'Procurar',
    DIRECT_CONVERSATIONS: 'Conversas Diretas',
    MY_GROUPS: 'Meus Grupos',
    NEW: 'Novo',
    AVAILABLE_GROUPS: 'Grupos Disponíveis',
    LEADER: 'Líder',
    MEMBER: 'Membro',
    MEMBERS_COUNT: '{{count}} membros',
    JOIN: 'Entrar',
    NO_USERS_ONLINE: 'Nenhum usuário online ainda',
    NO_GROUPS_CREATED: 'Nenhum grupo criado ainda',
    NO_GROUPS_AVAILABLE: 'Nenhum grupo disponível no momento',
    SELECT_CONVERSATION: 'Selecione uma conversa para começar',
    TYPE_MESSAGE: 'Digite sua mensagem...',
    SEND: 'Enviar'
  }

  constructor() {
    this.loadTranslations()
  }

  private async loadTranslations() {
    try {
      const response = await fetch(`/assets/i18n/${this.currentLang}.json`)

      if (!response.ok) {
        throw new Error(`Failed to load translations: ${response.status}`)
      }

      this.translations = await response.json()
    } catch (error) {
      console.warn('Using fallback translations:', error)
      this.translations = this.fallbackTranslations
    } finally {
      this.translationsLoaded = true
      this.translationsSubject.next(this.translations)
    }
  }

  translate(key: string, params?: { [key: string]: string | number }): string {
    let translation = this.translations[key] || this.fallbackTranslations[key] || key

    if (params) {
      Object.keys(params).forEach((param) => {
        const value = params[param]
        translation = translation.replace(new RegExp(`{{${param}}}`, 'g'), value.toString())

        if (param === 'count' && typeof value === 'number') {
          translation = translation.replace('{{plural}}', value > 1 ? 's' : '')
        }
      })
    }

    return translation
  }

  getTranslations(): Observable<{ [key: string]: string }> {
    return this.translationsSubject.asObservable()
  }

  isLoaded(): boolean {
    return this.translationsLoaded
  }
}
