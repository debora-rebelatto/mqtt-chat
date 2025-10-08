import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'

@Injectable({
  providedIn: 'root'
})
export abstract class BaseStorageService<T extends { id: string }> {
  protected itemsSubject = new BehaviorSubject<T[]>([])
  public items$ = this.itemsSubject.asObservable()

  protected abstract readonly storageKey: string

  constructor() {
    this.loadFromStorage()
  }

  get items(): T[] {
    return this.itemsSubject.value
  }

  protected addOrUpdateItem(item: T): void {
    const current = this.itemsSubject.value
    const existingIndex = current.findIndex((existing) => existing.id === item.id)

    let updated: T[]
    if (existingIndex >= 0) {
      updated = [...current]
      updated[existingIndex] = item
    } else {
      updated = [...current, item]
    }

    this.itemsSubject.next(updated)
    this.saveToStorage(updated)
  }

  protected removeItem(id: string): boolean {
    const current = this.itemsSubject.value
    const filtered = current.filter((item) => item.id !== id)
    
    if (filtered.length !== current.length) {
      this.itemsSubject.next(filtered)
      this.saveToStorage(filtered)
      return true
    }
    return false
  }

  protected setItems(items: T[]): void {
    this.itemsSubject.next(items)
    this.saveToStorage(items)
  }

  protected clearItems(): void {
    this.itemsSubject.next([])
    localStorage.removeItem(this.storageKey)
  }

  private loadFromStorage(): void {
    const stored = localStorage.getItem(this.storageKey)
    if (stored) {
      try {
        const data = JSON.parse(stored)
        const items = this.deserializeItems(data)
        this.itemsSubject.next(items)
      } catch (error) {
        console.error(`Erro ao carregar ${this.storageKey}:`, error)
        localStorage.removeItem(this.storageKey)
      }
    }
  }

  private saveToStorage(items: T[]): void {
    const serialized = this.serializeItems(items)
    localStorage.setItem(this.storageKey, JSON.stringify(serialized))
  }

  protected abstract deserializeItems(data: unknown[]): T[]
  protected abstract serializeItems(items: T[]): unknown[]
}
