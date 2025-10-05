import { Pipe, PipeTransform } from '@angular/core'
import { TranslationService } from '../services'

@Pipe({
  name: 'memberCount',
  standalone: true
})
export class MemberCountPipe implements PipeTransform {
  constructor(private translationService: TranslationService) {}

  transform(count: number): string {
    return this.translationService.translate('MEMBERS_COUNT', { count })
  }
}
