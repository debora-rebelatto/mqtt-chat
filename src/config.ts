export const MQTT_CONFIG = {
  BROKER_URL: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  TOPICS: {
    DIRECT_MESSAGE: (userId: string) => `user/${userId}/direct`,
    GROUP_MESSAGE: (groupId: string) => `group/${groupId}/messages`,
    USER_PRESENCE: 'users/presence',
    USER_TYPING: (userId: string) => `user/${userId}/typing`
  }
}

const uniqueId = crypto.randomUUID().replace(/-/g, '').substring(0, 9)

export const USER_ID = process.env.USER_ID || `user_${uniqueId}`
export const USER_NAME = process.env.USER_NAME || `User_${uniqueId.substring(0, 5)}`