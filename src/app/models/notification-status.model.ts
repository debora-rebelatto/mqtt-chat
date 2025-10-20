export class NotificationStatus {
  static pending = new NotificationStatus('pending')
  static accepted = new NotificationStatus('accepted')
  static rejected = new NotificationStatus('rejected')

  private constructor(public id: NotificationStatusKey) {}

  private static map = new Map<NotificationStatusKey, NotificationStatus>([
    [this.pending.id, this.pending],
    [this.accepted.id, this.accepted],
    [this.rejected.id, this.rejected]
  ])

  static fromValue(value: string): NotificationStatus {
    const result = this.map.get(value as NotificationStatusKey)
    if (!result) throw new Error(`Invalid NotificationStatus: ${value}`)

    return result
  }

  static enumerate(): Array<NotificationStatus> {
    return [...NotificationStatus.map.values()]
  }

  get isPending(): boolean {
    return this.id === 'pending'
  }

  get isAccepted(): boolean {
    return this.id === 'accepted'
  }

  get isRejected(): boolean {
    return this.id === 'rejected'
  }
}

export type NotificationStatusKey = 'pending' | 'accepted' | 'rejected'
