# Documentação do Projeto MQTT Chat

### Estrutura de Diretórios
```
src/app/
├── components/          # Componentes reutilizáveis
├── features/           # Funcionalidades principais
│   ├── chat/          # Sistema de chat
│   ├── groups/        # Gerenciamento de grupos
│   └── users/         # Gerenciamento de usuários
├── models/            # Classes de domínio
├── services/          # Serviços e lógica de negócio
└── pipes/            # Pipes customizados
```

## Definição de Tópicos MQTT

### Estrutura de Tópicos Implementada

```
meu-chat-mqtt/
├── status                        # Status online/offline dos usuários
├── messages/
│   ├── {userId}                  # Mensagens individuais para cada usuário
│   └── groups                    # Mensagens de grupo (broadcast)
├── groups                        # Informações e atualizações de grupos
├── invitations/
│   ├── requests                  # Solicitações de entrada em grupos
│   └── responses                 # Respostas aos convites
└── group-updates/
    └── {userId}                  # Notificações específicas por usuário
```

### Configuração MQTT

- **QoS:** 1 (garante entrega pelo menos uma vez)
- **cleanSession:** false (mantém assinaturas entre reconexões)
- **Broker:** Mosquitto em localhost:8081
- **Protocolo:** WebSocket

### Exemplos de Payloads

Ver arquivo `ARQUITETURA_SISTEMA.md` para detalhes completos dos formatos de mensagem.

## Modelos de Dados

### User
```typescript
export class User {
  id: string
  name: string
  online?: boolean
  lastSeen?: Date
  unread?: number
}
```

### Group
```typescript
export class Group {
  id: string
  name: string
  leader: User
  members: User[]
  createdAt: Date
  unread?: number
}
```

### Message
```typescript
export class Message {
  id: string
  sender: User
  content: string
  timestamp: Date
  chatType: ChatType
  chatId: string
}
```

### GroupInvitation
```typescript
export class GroupInvitation {
  id: string
  groupId: string
  groupName: string
  invitee: User
  timestamp: Date
}
```

## Funcionalidades Principais

### Comunicação
- **Chat um-a-um:** Mensagens diretas entre usuários
- **Chat em grupo:** Comunicação com múltiplos participantes
- **Status online/offline:** Indicadores em tempo real
- **Sistema de convites:** Solicitação de entrada em grupos

### Gerenciamento
- **Criação de grupos:** Interface para novos grupos
- **Listagem de usuários:** Visualização de usuários disponíveis
- **Notificações:** Painel de convites pendentes
- **Sincronização:** Atualização automática via MQTT


## Instruções de Uso

### Uso da Aplicação
1. **Login:** Inserir nome de usuário na tela inicial
2. **Chat Individual:** Selecionar usuário na lista lateral
3. **Criar Grupo:** Usar formulário "Criar Grupo"
4. **Entrar em Grupo:** Solicitar entrada via "Procurar Grupos"
5. **Aceitar Convites:** Usar painel de notificações

## Referências

- **Arquitetura detalhada:** Ver `ARQUITETURA_SISTEMA.md`
- **Manual do usuário:** Ver `MANUAL_USUARIO.md`
- **Status de implementação:** Ver `CHECKLIST_ENTREGA.md`

