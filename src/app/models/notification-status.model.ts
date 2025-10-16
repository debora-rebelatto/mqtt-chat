export class NotificationStatus {
  static pending = new NotificationStatus('pending')
  static accepted = new NotificationStatus('accepted')
  static rejected = new NotificationStatus('rejected')
  static expired = new NotificationStatus('expired')

  private constructor(public id: NotificationStatusKey) {}

  private static map = new Map<NotificationStatusKey, NotificationStatus>([
    [this.pending.id, this.pending],
    [this.accepted.id, this.accepted],
    [this.rejected.id, this.rejected],
    [this.expired.id, this.expired]
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

  get isExpired(): boolean {
    return this.id === 'expired'
  }
}

export type NotificationStatusKey = 'pending' | 'accepted' | 'rejected' | 'expired'
