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
      this.translationsLoaded = true
      this.translationsSubject.next(this.translations)
    } catch (error) {
      console.error('Error loading translations:', error)
      // Fallback para traduções vazias
      this.translations = {}
      this.translationsLoaded = true
      this.translationsSubject.next(this.translations)
    }
  }

  translate(key: string, params?: { [key: string]: string | number }): string {
    if (!this.translationsLoaded) {
      return key
    }

    let translation = this.translations[key] || key

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
