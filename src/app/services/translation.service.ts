import { Injectable } from '@angular/core'
import { BehaviorSubject, Observable } from 'rxjs'

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private translations: { [key: string]: string } = {}
  private currentLang = 'br'
  private translationsSubject = new BehaviorSubject<{ [key: string]: string }>({})

  constructor() {
    this.translations = {
      'CHAT_TITLE': 'Chat MQTT',
      'CONVERSATIONS': 'Conversas',
      'SEARCH': 'Procurar',
      'DIRECT_CONVERSATIONS': 'Conversas Diretas',
      'MY_GROUPS': 'Meus Grupos',
      'NEW': 'Novo',
      'AVAILABLE_GROUPS': 'Grupos Disponíveis',
      'LEADER': 'Líder',
      'MEMBER': 'Membro',
      'MEMBERS_COUNT': '{{count}} membros',
      'JOIN': 'Entrar',
      'NO_USERS_ONLINE': 'Nenhum usuário online ainda',
      'NO_GROUPS_CREATED': 'Nenhum grupo criado ainda',
      'NO_GROUPS_AVAILABLE': 'Nenhum grupo disponível no momento',
      'SELECT_CONVERSATION': 'Selecione uma conversa para começar',
      'LAST_SEEN': 'Visto {{time}}',
      'NOW': 'agora',
      'MINUTES_AGO': '{{count}} min atrás',
      'HOURS_AGO': '{{count}} h atrás',
      'DAYS_AGO': '{{count}} dia{{plural}} atrás',
      'CONNECT': 'Conectar',
      'CONNECTING': 'Conectando...',
      'CONNECTED': 'Conectado',
      'DISCONNECTED': 'Desconectado',
      'USERNAME': 'Nome de usuário',
      'CREATE_GROUP': 'Criar Grupo',
      'GROUP_NAME': 'Nome do Grupo',
      'CANCEL': 'Cancelar',
      'CREATE': 'Criar',
      'TYPE_MESSAGE': 'Digite sua mensagem...',
      'SEND': 'Enviar',
      'DISCONNECT': 'Sair'
    }
    this.translationsSubject.next(this.translations)
  }

  private async loadTranslations() {
    const response = await fetch(`assets/i18n/${this.currentLang}.json`)
    this.translations = await response.json()
    this.translationsSubject.next(this.translations)
  }

  translate(key: string, params?: { [key: string]: string | number }): string {
    let translation = this.translations[key] || key

    if (params) {
      Object.keys(params).forEach(param => {
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
}
