import { User } from './user.model'

export interface PrivateChatRequest {
  id: string
  from: User
  to: string
  timestamp: Date
  status: 'pending' | 'accepted' | 'rejected'
}
