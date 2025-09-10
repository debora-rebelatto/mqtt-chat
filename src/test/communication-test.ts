import { MQTTService } from "../services/mqtt-service"
import { UserService } from "../services/user-services"
import type { Message } from "../types/message.model"
import type { User } from "../types/user.model"


const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
}

// Função helper para criar usuários de teste
function createTestUser(id: string, name: string): User {
  return {
    id,
    name,
    isOnline: true
  }
}

const TEST_USERS: User[] = [
  createTestUser('user_alice', 'Alice'),
  createTestUser('user_bob', 'Bob'),
  createTestUser('user_charlie', 'Charlie')
]

const TEST_GROUP = {
  id: 'group_devs',
  name: 'Time de Desenvolvimento'
}

async function testOneToOneCommunication() {
  logger.info('🔍 TESTANDO COMUNICAÇÃO ONE-TO-ONE...')
  process.env.USER_ID = TEST_USERS[0]?.id
  process.env.USER_NAME = TEST_USERS[0]?.name

  const aliceService = new MQTTService()
  const aliceUser = new UserService(aliceService)
  aliceUser.addKnownUser(TEST_USERS[1]!)
  aliceUser.addKnownUser(TEST_USERS[2]!)

  // Create a promise that resolves when message is received
  const messagePromise = new Promise<Message>((resolve) => {
    aliceService.onMessage((message: Message) => {
      logger.info(`📩 Alice recebeu: "${message.content}" de ${message.from}`)
      resolve(message)
    })
  })

  try {
    await aliceService.connect()
    aliceService.updatePresence(true)
    await new Promise(resolve => setTimeout(resolve, 2000))

    logger.info('💌 Alice enviando mensagem para Bob...')
    aliceUser.sendMessageToUser(TEST_USERS[1]?.id ?? '', 'Olá Bob, tudo bem?')

    const simulatedBobMessage: Message = {
      from: TEST_USERS[1]?.id ?? '',
      to: TEST_USERS[0]?.id ?? '',
      content: 'Oi Alice! Tudo sim, e contigo?',
      timestamp: new Date(),
      type: 'direct'
    }

    aliceService['handleIncomingMessage'](
      `user/${TEST_USERS[0]?.id}/direct`,
      JSON.stringify(simulatedBobMessage)
    )

    // Wait for the message with timeout
    const receivedMessage = await Promise.race([
      messagePromise,
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 5000)
      )
    ])

    if (receivedMessage && receivedMessage.content.includes('Oi Alice')) {
      logger.info('✅ TESTE ONE-TO-ONE PASSOU!')
    } else {
      logger.error('❌ TESTE ONE-TO-ONE FALHOU!')
    }

    aliceService.disconnect()
  } catch (error) {
    logger.error('❌ Erro no teste one-to-one:', error)
  }
}

async function testGroupCommunication() {
  logger.info('\n🔍 TESTANDO COMUNICAÇÃO EM GRUPO...')

  process.env.USER_ID = TEST_USERS[0]?.id
  process.env.USER_NAME = TEST_USERS[0]?.name

  const aliceService = new MQTTService()
  const aliceUser = new UserService(aliceService)

  aliceUser.addKnownUser(TEST_USERS[1]!)
  aliceUser.addKnownUser(TEST_USERS[2]!)

  const groupMessages: Message[] = []

  aliceService.onMessage((message) => {
    if (message.type === 'group') {
      groupMessages.push(message)
      logger.info(`📢 Mensagem de grupo: ${message.from} -> "${message.content}"`)
    }
  })

  try {
    await aliceService.connect()
    aliceService.updatePresence(true)

    const group = aliceUser.createGroup(TEST_GROUP.name, [
      TEST_USERS[1]?.id ?? '',
      TEST_USERS[2]?.id ?? ''
    ])

    await new Promise(resolve => setTimeout(resolve, 1000))

    aliceUser.sendMessageToGroup(group.id, 'Bom dia time! Reunião às 10h!')

    const bobMessage: Message = {
      from: TEST_USERS[1]!.id,
      to: group.id,
      content: 'Bom dia Alice! Estarei presente.',
      timestamp: new Date(),
      type: 'group'
    }

    const charlieMessage: Message = {
      from: TEST_USERS[2]!.id,
      to: group.id,
      content: 'Ótimo! Levo o café!',
      timestamp: new Date(),
      type: 'group'
    }

    aliceService['handleIncomingMessage'](
      `group/${group.id}/messages`,
      JSON.stringify(bobMessage)
    )

    aliceService['handleIncomingMessage'](
      `group/${group.id}/messages`,
      JSON.stringify(charlieMessage)
    )

    await new Promise(resolve => setTimeout(resolve, 1000))

    if (groupMessages.length >= 3) {
      logger.info('✅ TESTE DE GRUPO PASSOU!')
    } else {
      logger.error('❌ TESTE DE GRUPO FALHOU!')
    }

    aliceService.disconnect()

  } catch (error) {
    logger.error('❌ Erro no teste de grupo:', error)
  }
}

async function testIntegration() {
  logger.info('\n🎯 TESTE DE INTEGRAÇÃO COMPLETA...')
  await testOneToOneCommunication()
  await testGroupCommunication()
  logger.info('\n🎉 TESTES CONCLUÍDOS!')
}

testIntegration().catch(error => {
  logger.error('Erro fatal nos testes:', error)
  process.exit(1)
})