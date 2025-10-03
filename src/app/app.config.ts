import { ApplicationConfig } from '@angular/core'
import { provideRouter } from '@angular/router'
import { routes } from './app.routes'
import { TranslationService } from './services/translation.service'

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    TranslationService
  ]
}
