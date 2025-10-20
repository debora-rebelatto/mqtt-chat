import { IdGeneratorService } from './id-generator.service'
import { Injectable } from '@angular/core'

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
  private authTimeout: any = null

  constructor(private idGeneratorService: IdGeneratorService) {
    this.initializeDefaultUsers()
  }

  private initializeDefaultUsers() {
    this.users.set('debora', {
      password: '123',
      userId: 'user_debora'
    })

    this.users.set('bruno', {
      password: '123',
      userId: 'user_bruno'
    })
  }

  async authenticate(username: string, password: string): Promise<AuthResponse> {
    return new Promise((resolve, reject) => {
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

    return {
      success: true,
      userId: userId,
      message: 'Conta criada com sucesso'
    }
  }

  clearAuthTimeout() {
    if (this.authTimeout) {
      clearTimeout(this.authTimeout)
      this.authTimeout = null
    }
  }
}
