import { Component, Input } from '@angular/core'

@Component({
  selector: 'badge',
  templateUrl: 'badge.component.html'
})
export class BadgeComponent {
  @Input() type: 'leader' | 'member' | 'unread' = 'member'
  @Input() text!: string

  get classes(): string {
    const base = 'text-xs px-2 py-1 rounded-full'
    const types = {
      leader: 'bg-green-900 text-green-300',
      member: 'bg-blue-900 text-blue-300',
      unread: 'bg-red-500 text-white w-5 h-5 flex items-center justify-center rounded-full'
    }
    return `${base} ${types[this.type]}`
  }
}
