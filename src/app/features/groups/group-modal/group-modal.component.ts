import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { TranslatePipe } from '../../../pipes/translate.pipe'

@Component({
  selector: 'group-modal',
  templateUrl: './group-modal.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe]
})
export class GroupModalComponent {
  @Input() showModal = false
  @Input() newGroupName = ''

  @Output() modalClose = new EventEmitter<void>()
  @Output() groupCreate = new EventEmitter<void>()
  @Output() groupNameChange = new EventEmitter<string>()

  onModalClick(event: Event) {
    event.stopPropagation()
  }
}
