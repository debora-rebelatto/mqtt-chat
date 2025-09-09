export const MQTT_CONFIG = {
  BROKER_URL: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  TOPICS: {
    DIRECT_MESSAGE: (userId: string) => `user/${userId}/direct`,
    GROUP_MESSAGE: (groupId: string) => `group/${groupId}/messages`,
    USER_PRESENCE: 'users/presence',
    USER_TYPING: (userId: string) => `user/${userId}/typing`
  }
};

// Estas são variáveis separadas, não parte do MQTT_CONFIG
export const USER_ID = process.env.USER_ID || `user_${Math.random().toString(36).substr(2, 9)}`;
export const USER_NAME = process.env.USER_NAME || `User_${USER_ID.substr(0, 5)}`;