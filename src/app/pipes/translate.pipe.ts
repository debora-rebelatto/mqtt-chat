import { Pipe, PipeTransform, ChangeDetectorRef, OnDestroy } from '@angular/core'
import { Subscription } from 'rxjs'
import { TranslationService } from '../services'
@Pipe({
  name: 'translate',
  standalone: true,
  pure: false
})
export class TranslatePipe implements PipeTransform, OnDestroy {
  private subscription?: Subscription
  private lastKey?: string
  private lastParams?: { [key: string]: string | number }
  private lastValue?: string

  constructor(
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) {}

  transform(key: string, params?: { [key: string]: string | number }): string {
    if (!key) return ''

    if (this.lastKey !== key || JSON.stringify(this.lastParams) !== JSON.stringify(params)) {
      this.lastKey = key
      this.lastParams = params
      this.updateValue()

      if (!this.subscription) {
        this.subscription = this.translationService.getTranslations().subscribe(() => {
          this.updateValue()
          this.cdr.markForCheck()
        })
      }
    }

    return this.lastValue || key
  }

  private updateValue(): void {
    this.lastValue = this.translationService.translate(this.lastKey!, this.lastParams)
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe()
    }
  }
}
