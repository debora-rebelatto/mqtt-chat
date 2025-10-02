import { Injectable, OnDestroy } from '@angular/core'
import { BehaviorSubject, Observable } from 'rxjs'

@Injectable({
  providedIn: 'root'
})
export class ConnectionManagerService implements OnDestroy {
  private connectedSubject = new BehaviorSubject<boolean>(false)
  private clientIdSubject = new BehaviorSubject<string>('')
  private heartbeatInterval: any = null

  connected$: Observable<boolean> = this.connectedSubject.asObservable()
  clientId$: Observable<string> = this.clientIdSubject.asObservable()

  get connected(): boolean {
    return this.connectedSubject.value
  }

  get clientId(): string {
    return this.clientIdSubject.value
  }

  ngOnDestroy() {
    this.stopHeartbeat()
  }

  generateClientId(username: string): string {
    const randomPart = Math.random().toString(16).substring(2, 8)
    return `chat_${username}_${randomPart}`
  }

  setConnected(connected: boolean, clientId: string = '') {
    this.connectedSubject.next(connected)
    if (clientId) {
      this.clientIdSubject.next(clientId)
    }
  }

  startHeartbeat(callback: () => void, interval: number = 30000) {
    this.stopHeartbeat()

    this.heartbeatInterval = setInterval(() => {
      if (this.connected) {
        callback()
      }
    }, interval)
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  reset() {
    this.setConnected(false, '')
    this.stopHeartbeat()
  }
}
