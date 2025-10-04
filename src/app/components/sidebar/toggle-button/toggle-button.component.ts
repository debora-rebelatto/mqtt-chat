import { Component, Input, Output, EventEmitter } from '@angular/core'

@Component({
  selector: 'toggle-button',
  templateUrl: './toggle-button.component.html'
})
export class ToggleButtonComponent {
  @Input() isActive: boolean = false
  @Input() disabled: boolean = false
  @Output() onClick = new EventEmitter<void>()
}
