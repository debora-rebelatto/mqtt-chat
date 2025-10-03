import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'

@Component({
  selector: 'app-group-modal',
  templateUrl: './group-modal.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class GroupModalComponent {
  @Input() showModal = false
  @Input() newGroupName = ''

  @Output() modalClose = new EventEmitter<void>()
  @Output() groupCreate = new EventEmitter<void>()
  @Output() groupNameChange = new EventEmitter<string>()
  @Output() modalKeyPress = new EventEmitter<KeyboardEvent>()

  onClose() {
    this.modalClose.emit()
  }

  onCreate() {
    this.groupCreate.emit()
  }

  onGroupNameChange(value: string) {
    this.groupNameChange.emit(value)
  }

  onKeyPress(event: KeyboardEvent) {
    this.modalKeyPress.emit(event)
  }

  onModalClick(event: Event) {
    event.stopPropagation()
  }
}
