import { NgModule } from '@angular/core'
import { BrowserModule } from '@angular/platform-browser'
import { FormsModule } from '@angular/forms'
import { MqttService } from './services/mqtt.service'
import { AppComponent } from './app.component'
import { LoginComponent } from './components/login/login.component'

@NgModule({
  declarations: [],
  imports: [BrowserModule, FormsModule, AppComponent, LoginComponent],
  providers: [MqttService]
})
export class AppModule {}
