import { Pipe, PipeTransform } from '@angular/core'

@Pipe({
  name: 'memberCount',
  standalone: true
})
export class MemberCountPipe implements PipeTransform {
  transform(count: number): string {
    if (count === 0) return 'Nenhum membro'
    if (count === 1) return '1 membro'
    return `${count} membros`
  }
}