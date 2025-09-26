import { NgModule } from '@angular/core'
import { BrowserModule } from '@angular/platform-browser'
import { FormsModule } from '@angular/forms'
import { AppComponent } from './app.component'
import { LoginComponent } from './components/login/login.component'
import { MqttFacadeService } from './services/mqtt-facade.service'

@NgModule({
  declarations: [],
  imports: [BrowserModule, FormsModule, AppComponent, LoginComponent],
  providers: [MqttFacadeService]
})
export class AppModule {}
