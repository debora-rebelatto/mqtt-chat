import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection
} from '@angular/core'
import { provideRouter } from '@angular/router'

import { routes } from './app.routes'
import { MqttService } from './services/mqtt.service'

export const appConfig: ApplicationConfig = {
  providers: [
    MqttService,
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes)
  ]
}
