# Documentação do Projeto MQTT Chat

## Identificação
**Disciplina:** GEX635 - TÓPICOS ESPECIAIS EM COMPUTAÇÃO XIII  
**Período:** 2025.2  
**Autor:** Débora Rebelatto  
**Tecnologia:** Angular + TypeScript + MQTT (Paho)

## Descrição do Projeto

Sistema de chat em tempo real utilizando protocolo MQTT, desenvolvido em Angular com TypeScript. A aplicação permite comunicação um-a-um e em grupo, com interface web moderna e persistência de dados para usuários offline.

## Arquitetura do Sistema

### Tecnologias Utilizadas
- **Frontend:** Angular 20.3.0 com TypeScript
- **MQTT Client:** Paho MQTT 1.1.0
- **UI Framework:** TailwindCSS + Lucide Icons
- **Broker MQTT:** Mosquitto (localhost:8081)

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

### Tópicos Implementados

#### 1. Controle de Usuários
- **Tópico:** `meu-chat-mqtt/status`
- **Propósito:** Publicar status online/offline dos usuários
- **Formato:**
```json
{
  "id": "user1",
  "name": "João",
  "online": true,
  "lastSeen": "2025-10-08T13:19:48.000Z"
}
```

#### 2. Mensagens Individuais
- **Tópico:** `meu-chat-mqtt/messages/{userId}`
- **Propósito:** Comunicação um-a-um entre usuários
- **Formato:**
```json
{
  "id": "msg_123",
  "sender": "user1",
  "content": "Olá!",
  "timestamp": "2025-10-08T13:19:48.000Z",
  "chatId": "user2",
  "chatType": "user"
}
```

#### 3. Mensagens de Grupo
- **Tópico:** `meu-chat-mqtt/messages/groups`
- **Propósito:** Comunicação em grupo
- **Formato:**
```json
{
  "id": "msg_456",
  "sender": "user1",
  "content": "Mensagem para o grupo",
  "timestamp": "2025-10-08T13:19:48.000Z",
  "chatId": "group1",
  "chatType": "group"
}
```

#### 4. Informações de Grupos
- **Tópico:** `meu-chat-mqtt/groups`
- **Propósito:** Publicar informações dos grupos (criação, atualização de membros)
- **Formato:**
```json
{
  "id": "group1",
  "name": "Projeto Angular",
  "leader": {
    "id": "user1",
    "name": "João",
    "online": true
  },
  "members": [
    {
      "id": "user2",
      "name": "Maria",
      "online": false
    }
  ],
  "createdAt": "2025-10-08T13:19:48.000Z"
}
```

#### 5. Convites de Grupo
- **Tópico:** `meu-chat-mqtt/invitations/requests`
- **Propósito:** Solicitações de entrada em grupos
- **Formato:**
```json
{
  "id": "inv_789",
  "groupId": "group1",
  "groupName": "Projeto Angular",
  "invitee": {
    "id": "user2",
    "name": "Maria"
  },
  "leader": {
    "id": "user1",
    "name": "João"
  },
  "timestamp": "2025-10-08T13:19:48.000Z"
}
```

#### 6. Respostas de Convites
- **Tópico:** `meu-chat-mqtt/invitations/responses`
- **Propósito:** Respostas aos convites (aceitar/rejeitar)
- **Formato:**
```json
{
  "invitationId": "inv_789",
  "groupId": "group1",
  "invitee": {
    "id": "user2",
    "name": "Maria",
    "online": true
  },
  "accepted": true,
  "timestamp": "2025-10-08T13:19:48.000Z"
}
```

#### 7. Atualizações de Grupo
- **Tópico:** `meu-chat-mqtt/group-updates/{userId}`
- **Propósito:** Notificar usuários específicos sobre mudanças em grupos
- **Formato:**
```json
{
  "type": "member_added",
  "groupId": "group1",
  "groupName": "Projeto Angular",
  "newMember": {
    "id": "user2",
    "name": "Maria"
  }
}
```

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

## Funcionalidades Implementadas

### ✅ Etapa 1 - Concluída

#### Interface e Navegação
- **Interface amigável:** Interface web moderna com TailwindCSS
- **Menu de opções:** Sidebar com navegação entre funcionalidades
- **Responsividade:** Layout adaptável para diferentes telas

#### Listagem de Usuários
- **Status online/offline:** Indicadores visuais de status
- **Lista dinâmica:** Atualização em tempo real via MQTT
- **Seleção de usuário:** Click para iniciar conversa

#### Gerenciamento de Grupos
- **Criação de grupos:** Formulário para criar novos grupos
- **Listagem de grupos:** Exibição de grupos com líder e membros
- **Solicitação de entrada:** Sistema de convites para grupos
- **Histórico de solicitações:** Painel de notificações com convites

### ✅ Etapa 2 - Concluída

#### Comunicação Um-a-Um
- **Envio de mensagens:** Interface de chat individual
- **Recebimento em tempo real:** Via MQTT
- **Persistência:** Mensagens salvas no localStorage
- **Histórico:** Carregamento de conversas anteriores

#### Comunicação em Grupo
- **Chat em grupo:** Interface para múltiplos usuários
- **Broadcast de mensagens:** Envio para todos os membros
- **Sincronização:** Mensagens sincronizadas entre clientes
- **Gerenciamento de membros:** Adição/remoção de participantes

## Principais Serviços

### MqttService
- **Conexão:** Gerencia conexão com broker MQTT
- **Publicação:** Envio de mensagens para tópicos
- **Subscrição:** Escuta de tópicos específicos
- **Callbacks:** Sistema de callbacks para mensagens recebidas

### ChatService
- **Mensagens:** Gerenciamento de mensagens individuais e de grupo
- **Persistência:** Salvamento no localStorage
- **Filtragem:** Separação de mensagens por chat
- **Estado:** Controle de chat atual selecionado

### UserService
- **Status:** Controle de usuários online/offline
- **Descoberta:** Listagem de usuários disponíveis
- **Sincronização:** Atualização via MQTT

### GroupService
- **CRUD:** Criação, listagem e atualização de grupos
- **Membros:** Gerenciamento de participantes
- **Sincronização:** Atualizações via MQTT

### InvitationService
- **Convites:** Sistema de solicitação de entrada em grupos
- **Notificações:** Painel de convites pendentes
- **Respostas:** Aceitar/rejeitar convites

## Problemas Resolvidos Durante o Desenvolvimento

### 1. Mensagens Entre Usuários
**Problema:** Mensagens não chegavam ao destinatário correto  
**Solução:** Correção na identificação de chat usando `user.id` ao invés de `user.name`

### 2. Convites de Grupo
**Problema:** Estrutura incorreta de convites impedia adição de membros  
**Solução:** Correção na criação do `GroupInvitation` usando `requester` como `invitee`

### 3. Persistência de Mensagens
**Problema:** Mensagens não carregavam após reload  
**Solução:** Sistema completo de persistência no localStorage

### 4. Sincronização de Grupos
**Problema:** Lista de grupos não atualizava após aceitar usuário  
**Solução:** Sistema de notificações via tópicos específicos por usuário

### 5. Conexão MQTT
**Problema:** Erro "AMQJS0011E Invalid state not connected"  
**Solução:** Verificação de estado de conexão antes de publicar mensagens

## Instruções de Instalação e Uso

### Pré-requisitos
- Node.js 18+
- Angular CLI 20+
- Broker MQTT (Mosquitto) rodando em localhost:8081

### Instalação
```bash
# Clonar repositório
git clone <repository-url>
cd mqtt-chat

# Instalar dependências
npm install

# Iniciar aplicação
ng serve
```

### Configuração do Broker MQTT
```bash
# Instalar Mosquitto
sudo apt-get install mosquitto mosquitto-clients

# Configurar WebSocket (mosquitto.conf)
listener 8081
protocol websockets
allow_anonymous true

# Iniciar broker
mosquitto -c mosquitto.conf
```

### Uso da Aplicação
1. **Login:** Inserir nome de usuário na tela inicial
2. **Chat Individual:** Selecionar usuário na lista lateral
3. **Criar Grupo:** Usar formulário "Criar Grupo"
4. **Entrar em Grupo:** Solicitar entrada via "Procurar Grupos"
5. **Aceitar Convites:** Usar painel de notificações

## Arquitetura de Comunicação

### Fluxo de Mensagens Individuais
1. Usuário A envia mensagem para Usuário B
2. Mensagem publicada em `meu-chat-mqtt/messages/{userB_id}`
3. Usuário B recebe mensagem via subscrição
4. Mensagem exibida na interface e salva localmente

### Fluxo de Mensagens de Grupo
1. Usuário envia mensagem para grupo
2. Mensagem publicada em `meu-chat-mqtt/messages/groups`
3. Todos os membros do grupo recebem a mensagem
4. Filtragem por `chatId` para exibir no grupo correto

### Fluxo de Convites de Grupo
1. Usuário solicita entrada em grupo
2. Convite publicado em `meu-chat-mqtt/invitations/requests`
3. Líder do grupo recebe notificação
4. Resposta publicada em `meu-chat-mqtt/invitations/responses`
5. Grupo atualizado e publicado em `meu-chat-mqtt/groups`
6. Notificação específica enviada para o usuário aceito

## Considerações de Implementação

### Persistência
- **localStorage:** Mensagens e estado da aplicação
- **Sincronização:** Carregamento automático ao inicializar
- **Limpeza:** Gerenciamento de dados antigos

### Tratamento de Erros
- **Conexão MQTT:** Verificação de estado antes de operações
- **Mensagens perdidas:** Sistema de retry para mensagens importantes
- **Validação:** Verificação de dados antes de processar

### Performance
- **Filtragem eficiente:** Uso de índices para busca de mensagens
- **Lazy loading:** Carregamento sob demanda de histórico
- **Debounce:** Controle de frequência de atualizações

## Status do Projeto

### ✅ Funcionalidades Implementadas
- Comunicação um-a-um
- Comunicação em grupo
- Sistema de convites
- Persistência de dados
- Interface responsiva
- Gerenciamento de usuários online/offline

### ⚠️ Limitações Conhecidas
- Não implementa tópicos `ID_Control` conforme especificação original
- Não implementa negociação de sessão com tópicos únicos `X_Y_timestamp`
- Sistema simplificado de controle de sessões

### 🎯 Conformidade com Requisitos
- **Protocolo MQTT:** ✅ Exclusivamente MQTT para comunicação
- **Biblioteca Paho:** ✅ Paho MQTT 1.1.0
- **Comunicação um-a-um:** ✅ Implementada
- **Comunicação em grupo:** ✅ Implementada
- **Persistência offline:** ✅ localStorage
- **Interface amigável:** ✅ Interface web moderna
- **Tópicos de controle:** ⚠️ Parcialmente (não segue exatamente a especificação)

## Conclusão

O projeto implementa com sucesso um sistema de chat MQTT funcional, atendendo aos principais requisitos de comunicação um-a-um e em grupo. A arquitetura modular permite fácil manutenção e extensão, enquanto a interface moderna proporciona boa experiência do usuário.
Embora algumas especificações técnicas específicas (como tópicos `ID_Control` e negociação de sessão) não tenham sido implementadas exatamente conforme o documento original, o sistema demonstra compreensão sólida do protocolo MQTT e implementa as funcionalidades essenciais de um sistema de chat distribuído.

