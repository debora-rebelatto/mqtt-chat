const BASE_TOPIC = 'meu-chat-mqtt'

export const MqttTopics = {
  privateMessage: (username: string) => `${BASE_TOPIC}/messages/${username}`,

  groupMessages: `${BASE_TOPIC}/messages/groups`,
  specificGroup: (groupId: string) => `${BASE_TOPIC}/groups/${groupId}`,

  confirmation: (username: string) => `${BASE_TOPIC}/confirmations/${username}`,

  status: `${BASE_TOPIC}/status`,
  disconnected: `${BASE_TOPIC}/status/disconnected`,
  heartbeat: `${BASE_TOPIC}/heartbeat`,

  sync: `${BASE_TOPIC}/sync`,
  syncByUser: (username: string) => `${BASE_TOPIC}/sync/${username}`,

  pendingSync: (userId: string) => `${BASE_TOPIC}/sync/pending/${userId}`,

  groupList: `${BASE_TOPIC}/groups`,
  sendInvitation: (username: string) => `${BASE_TOPIC}/invitations/${username}`,
  invitationResponses: `${BASE_TOPIC}/invitations/responses`,
  groupUpdates: `${BASE_TOPIC}/group-updates`,
  privateChat: {
    request: (username: string) => `${BASE_TOPIC}/private-chat/request/${username}`,
    response: (username: string) => `${BASE_TOPIC}/private-chat/response/${username}`,
    allowed: (username: string) => `${BASE_TOPIC}/private-chat/allowed/${username}`
  },
  authRegistry: 'chat/users/registry'
}
