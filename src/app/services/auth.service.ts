import { MqttTopics } from './../config/mqtt-topics'
import { Injectable } from '@angular/core'
import { MqttService } from './mqtt.service'
import { IdGeneratorService } from './id-generator.service'

export interface AuthResponse {
  success: boolean
  message?: string
  userId?: string
}

interface UserData {
  password: string
  userId: string
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private users: Map<string, UserData> = new Map()
  private authTimeout: ReturnType<typeof setTimeout> | null = null

  constructor(
    private mqttService: MqttService,
    private idGeneratorService: IdGeneratorService
  ) {}

  initialize(): void {
    this.initializeDefaultUsers()

    this.mqttService.subscribe(MqttTopics.authRegistry, (message) => {
      this.handleUserRegistry(message)
    })

    this.publishUsers()
  }

  private initializeDefaultUsers(): void {
    this.users.set('debora', {
      password: '123',
      userId: 'user_debora'
    })

    this.users.set('bruno', {
      password: '123',
      userId: 'user_bruno'
    })
  }

  private handleUserRegistry(message: string): void {
    const data = JSON.parse(message)

    if (data.type === 'user_registered' && data.username && data.userId) {
      if (!this.users.has(data.username)) {
        this.users.set(data.username, {
          password: data.password || '',
          userId: data.userId
        })
      }
    } else if (data.type === 'users_sync' && Array.isArray(data.users)) {
      data.users.forEach((user: { username: string; userId: string; password: string }) => {
        if (!this.users.has(user.username)) {
          this.users.set(user.username, {
            password: user.password || '',
            userId: user.userId
          })
        }
      })
    }
  }

  private publishUsers(): void {
    const usersArray = Array.from(this.users.entries()).map(([username, data]) => ({
      username,
      userId: data.userId,
      password: data.password
    }))

    const payload = {
      type: 'users_sync',
      users: usersArray,
      timestamp: new Date().toISOString()
    }

    this.mqttService.publish(MqttTopics.authRegistry, JSON.stringify(payload), true)
  }

  async authenticate(username: string, password: string): Promise<AuthResponse> {
    return new Promise<AuthResponse>((resolve, reject) => {
      if (this.authTimeout) {
        clearTimeout(this.authTimeout)
      }

      this.authTimeout = setTimeout(() => {
        reject(new Error('Timeout de autenticação'))
      }, 10000)

      try {
        const user = this.users.get(username)
        let response: AuthResponse

        if (!user || user.password !== password) {
          response = {
            success: false,
            message: 'Usuário ou senha incorretos'
          }
        } else {
          response = {
            success: true,
            userId: user.userId,
            message: 'Autenticação bem-sucedida'
          }
        }

        if (this.authTimeout) {
          clearTimeout(this.authTimeout)
          this.authTimeout = null
        }

        setTimeout(() => resolve(response), 100)
      } catch (error) {
        if (this.authTimeout) {
          clearTimeout(this.authTimeout)
          this.authTimeout = null
        }
        reject(error)
      }
    })
  }

  async signup(username: string, password: string): Promise<AuthResponse> {
    if (!username.trim() || !password.trim()) {
      throw new Error('Usuário e senha são obrigatórios')
    }

    if (this.users.has(username)) {
      throw new Error('Usuário já existe')
    }

    const userId = this.idGeneratorService.generateId('user_')

    this.users.set(username, {
      password: password,
      userId: userId
    })

    const payload = {
      type: 'user_registered',
      username,
      userId,
      password,
      timestamp: new Date().toISOString()
    }

    this.mqttService.publish(MqttTopics.authRegistry, JSON.stringify(payload), true)

    return {
      success: true,
      userId: userId,
      message: 'Conta criada com sucesso'
    }
  }

  clearAuthTimeout(): void {
    if (this.authTimeout) {
      clearTimeout(this.authTimeout)
      this.authTimeout = null
    }
  }
}
