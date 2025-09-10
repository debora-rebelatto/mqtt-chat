import { MQTTService } from "../services/mqtt-service"
import { UserService } from "../services/user-services"
import type { User } from "../types/user.model"


const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args)
}

class TestClient {
  public receivedMessages: any[] = []
  public mqttService: MQTTService
  public userService: UserService

  constructor(public id: string, public name: string) {
    process.env.USER_ID = id
    process.env.USER_NAME = name

    this.mqttService = new MQTTService()
    this.userService = new UserService(this.mqttService)

    this.mqttService.onMessage((message) => {
      this.receivedMessages.push(message)
      logger.info(`[${name}] 📨 Recebido: ${message.content}`)
    })
  }

  async connect() {
    await this.mqttService.connect()
    this.mqttService.updatePresence(true)
    return this
  }

  disconnect() {
    this.mqttService.updatePresence(false)
    this.mqttService.disconnect()
  }

  sendToUser(toUserId: string, content: string) {
    this.userService.sendMessageToUser(toUserId, content)
    logger.info(`[${this.name}] ➡️  Para ${toUserId}: ${content}`)
  }

  sendToGroup(groupId: string, content: string) {
    this.userService.sendMessageToGroup(groupId, content)
    logger.info(`[${this.name}] 📢 No grupo ${groupId}: ${content}`)
  }

  addKnownUser(user: User) {
    this.userService.addKnownUser(user)
  }
}

async function testRealCommunication() {
  logger.info('🎭 TESTE COM CLIENTES REAIS...')

  const alice = new TestClient('user_alice', 'Alice')
  const bob = new TestClient('user_bob', 'Bob')
  const charlie = new TestClient('user_charlie', 'Charlie')

  try {
    logger.info('🔗 Conectando clientes...')
    await Promise.all([alice.connect(), bob.connect(), charlie.connect()])

    alice.addKnownUser({ id: bob.id, name: bob.name, isOnline: true })
    alice.addKnownUser({ id: charlie.id, name: charlie.name, isOnline: true })
    bob.addKnownUser({ id: alice.id, name: alice.name, isOnline: true })
    charlie.addKnownUser({ id: alice.id, name: alice.name, isOnline: true })

  } finally {
    alice.disconnect()
    bob.disconnect()
    charlie.disconnect()
  }
}

testRealCommunication().catch(error => {
  logger.error('Erro no teste:', error)
  process.exit(1)
})