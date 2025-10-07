import { bootstrapApplication } from '@angular/platform-browser'
import { appConfig } from './app/app.config'
import { AppComponent } from './app/app.component'
import { TranslateService } from '@ngx-translate/core'

bootstrapApplication(AppComponent, appConfig).then(appRef => {
  const translate = appRef.injector.get(TranslateService)
  translate.use('br')
}).catch((err) => console.error(err))
