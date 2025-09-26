import { Pipe, PipeTransform } from '@angular/core'

@Pipe({
  name: 'dateShort',
  standalone: true
})
export class DateShortPipe implements PipeTransform {
  transform(value: string | Date): string {
    if (!value) return ''

    const date = typeof value === 'string' ? new Date(value) : value

    if (isNaN(date.getTime())) {
      return 'Data inválida'
    }

    // Formato: DD/MM/AAAA HH:MM
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')

    return `${day}/${month}/${year} ${hours}:${minutes}`
  }
}
