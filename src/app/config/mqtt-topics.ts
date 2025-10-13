const BASE_TOPIC = 'meu-chat-mqtt'

export const MqttTopics = {
  users: {},
  groups: {
    specificGroup: (groupId: string) => `${BASE_TOPIC}/groups/${groupId}`,
    groupList: `${BASE_TOPIC}/groups`,
    groupUpdates: `${BASE_TOPIC}/group-updates`
  },
  messages: {
    privateMessage: (username: string) => `${BASE_TOPIC}/messages/${username}`,
    groupMessages: `${BASE_TOPIC}/messages/groups`
  },
  status: {
    status: `${BASE_TOPIC}/status`,
    disconnected: `${BASE_TOPIC}/status/disconnected`
  },

  heartbeat: {
    heartbeat: `${BASE_TOPIC}/heartbeat`
  },
  sync: {
    sync: `${BASE_TOPIC}/sync`,
    syncByUser: (username: string) => `${BASE_TOPIC}/sync/${username}`,
    pendingSync: (userId: string) => `${BASE_TOPIC}/sync/pending/${userId}`
  },
  invitation: {
    invitationResponses: `${BASE_TOPIC}/invitations/responses`,
    confirmation: (username: string) => `${BASE_TOPIC}/confirmations/${username}`,
    sendInvitation: (username: string) => `${BASE_TOPIC}/invitations/${username}`
  }
}
