export interface Message {
  from: string
  to: string | string[]
  content: string
  timestamp: Date
  type: 'direct' | 'group'
}
