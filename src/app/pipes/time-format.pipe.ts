import { Pipe, PipeTransform } from '@angular/core'
import { TranslationService } from '../services'

@Pipe({
  name: 'timeFormat',
  standalone: true
})
export class TimeFormatPipe implements PipeTransform {
  constructor(private translationService: TranslationService) {}

  transform(date: Date | string | null): string {
    if (!date) return ''
    
    const dateObj = typeof date === 'string' ? new Date(date) : date
    const now = new Date()
    const diffMs = now.getTime() - dateObj.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) {
      return this.translationService.translate('NOW')
    }
    
    if (diffMins < 60) {
      return this.translationService.translate('MINUTES_AGO', { count: diffMins })
    }

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) {
      return this.translationService.translate('HOURS_AGO', { count: diffHours })
    }

    const diffDays = Math.floor(diffHours / 24)
    return this.translationService.translate('DAYS_AGO', { count: diffDays })
  }
}
