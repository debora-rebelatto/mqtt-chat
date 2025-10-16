import { Injectable } from '@angular/core'

@Injectable({
  providedIn: 'root'
})
export class IdGeneratorService {
  generateId(prefix: string = 'id'): string {
    const timestamp = Date.now()
    const random = Math.random().toString(16).substring(2, 8)
    return `${prefix}_${timestamp}_${random}`
  }
}
