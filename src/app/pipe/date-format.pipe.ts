import { Pipe, PipeTransform } from '@angular/core'

@Pipe({
  name: 'dateFormat',
  standalone: true
})
export class DateFormatPipe implements PipeTransform {
  transform(date: Date): string {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'agora'
    if (diffMins < 60) return `${diffMins} min atrás`

    const diffHours = Math.floor(diffMins / 60)

    if (diffHours < 24) return `${diffHours} h atrás`

    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} dia${diffDays > 1 ? 's' : ''} atrás`
  }
}
