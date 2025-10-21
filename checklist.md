# Checklist de Implementação - Chat MQTT

## ✅ Funcionalidades Implementadas

### Comunicação Básica

- [x] **Comunicação um-a-um (one-to-one)**
  - Implementado via `ChatService.sendUserMessage()`
  - Usa tópicos privados: `private/${userId}`

- [x] **Comunicação em grupo**
  - Implementado via `ChatService.sendGroupMessage()`
  - Usa tópicos: `groups/${groupId}/messages`

- [x] **Identificadores únicos de usuários**
  - Implementado via `IdGeneratorService`
  - IDs gerados com prefixos: `user_`, `group_`, `msg_`, etc.

- [x] **Persistência para usuários offline**
  - Implementado via `PendingMessagesService`
  - Mensagens são armazenadas e enviadas quando usuário fica online
  - Confirmação de recebimento via tópico `confirm/${userId}`

### Sistema de Grupos

- [x] **Tópico GROUPS**
  - Implementado como `MqttTopics.groupList`
  - Publicação de informações do grupo (nome, líder, membros)
  - Sincronização via retained messages

- [x] **Solicitação de ingresso em grupos**
  - Implementado via `InvitationService.requestJoinGroup()`
  - Sistema de convites com status (pending/accepted/rejected)
  - Líder aceita/rejeita solicitações

- [x] **Atualização de informações de grupo**
  - Tópico `group_updates` para mudanças nos grupos
  - Notificação de novos membros via `member_added`

## ⚠️ Funcionalidades Parcialmente Implementadas

### Tópico de Controle Individual (ID_Control)

#### ❌ Não Implementado Conforme Especificação

O requisito especifica:

- **Tópico**: `ID_Control` para cada usuário (ex: `X_Control`)
- **Uso**: Canal de controle para solicitações/negociações
- **Permissões**: Cada cliente assina seu próprio tópico (outros só publicam)

#### ✅ Implementação Atual (Diferente)

A aplicação usa múltiplos tópicos especializados:

- `private/${userId}` - mensagens privadas
- `invitations/${userId}` - convites de grupo
- `chat_request/${userId}` - solicitações de chat privado
- `chat_response/${userId}` - respostas às solicitações
- `confirm/${userId}` - confirmações de mensagens
- `pending_sync/${userId}` - sincronização de mensagens perdidas

**Status**: 🟡 **Parcial** - A funcionalidade existe mas está distribuída em vários tópicos ao invés de um único `ID_Control`

### Sistema de Sessões com Identificador Único

#### ❌ Não Implementado Conforme Especificação

O requisito especifica:

- Solicitação/negociação via canal de controle
- Cada sessão deve ter identificador único para o par de usuários
- Formato sugerido: `X_Y_timestamp`
- Usuário solicitado cria tópico com nome da sessão
- ID da sessão comunicado via publicação no `ID_Control` do solicitante

#### ✅ Implementação Atual (Simplificada)

- Sistema de solicitação via `PrivateChatRequestService`
- Autorização prévia necessária (`allowedChats`)
- Mensagens diretas via tópico fixo `private/${userId}`
- Não há criação dinâmica de tópicos por sessão

**Status**: 🔴 **Não Implementado** - Não há sistema de identificadores únicos por sessão de conversa

### Tópico de Controle USERS

#### ❌ Não Implementado Conforme Especificação

O requisito especifica:

- **Tópico único**: `USERS` para status de todos os usuários
- Publicação de status online/offline de cada usuário
- Status online ao iniciar aplicativo
- Status offline antes de encerrar aplicativo

#### ✅ Implementação Atual (Melhorada)

A aplicação usa sistema mais robusto:

- `user_status` - status online/offline
- `user_disconnected` - notificações de desconexão
- `heartbeat` - verificação contínua de presença (5s)
- `user_sync` - sincronização de usuários

**Benefícios da implementação atual**:

- Detecção automática de desconexão (timeout de 30s)
- Heartbeat para monitoramento em tempo real
- Mais confiável que depender apenas de notificação manual

**Status**: 🟢 **Implementado com Melhorias** - Funcionalidade equivalente mas com arquitetura diferente

## 📋 Itens Faltantes para Conformidade Exata

### 1. Tópico ID_Control Unificado

- [ ] Criar tópico `${userId}_Control` para cada usuário
- [ ] Consolidar solicitações de chat, convites e controles neste tópico
- [ ] Implementar sistema de tipos de mensagem no tópico de controle:
  - `chat_request` - solicitação de chat
  - `group_invitation` - convite para grupo
  - `session_create` - criação de sessão
  - `control_ack` - confirmações

### 2. Sistema de Sessões com ID Único

- [ ] Implementar geração de ID de sessão: `${userA}_${userB}_${timestamp}`
- [ ] Criar tópico dinâmico por sessão ao aceitar solicitação
- [ ] Comunicar ID da sessão via tópico de controle do solicitante
- [ ] Publicar mensagens no tópico da sessão (não mais em tópico fixo do usuário)
- [ ] Gerenciar ciclo de vida das sessões (criação, uso, encerramento)

### 3. Tópico USERS Único (Opcional)

- [ ] Consolidar `user_status` e `user_disconnected` em tópico único `USERS`
- [ ] Manter heartbeat como mecanismo adicional de confiabilidade
- [ ] Formato de mensagem padronizado para status

## 🎯 Recomendações

### Opção 1: Manter Implementação Atual ✅ RECOMENDADO

**Justificativa**: A implementação atual é mais robusta e escalável

- Sistema de tópicos especializados facilita manutenção
- Heartbeat oferece detecção confiável de offline
- Arquitetura preparada para crescimento

**Mudanças mínimas necessárias**:

- Adicionar documentação explicando divergências da especificação
- Justificar melhorias arquiteturais

### Opção 2: Adaptar para Conformidade Estrita

**Esforço**: Alto (2-3 dias de desenvolvimento)
**Itens necessários**:

1. Implementar `ID_Control` unificado
2. Sistema completo de sessões com IDs únicos
3. Tópico `USERS` único
4. Refatorar fluxos existentes

**Riscos**:

- Perda de funcionalidades avançadas (heartbeat, confirmações)
- Código menos modular
- Dificuldade em escalar

## 📊 Resumo Geral

| Categoria                | Status       | Detalhes                   |
| ------------------------ | ------------ | -------------------------- |
| Comunicação 1-1 e Grupos | ✅ Completo  | Totalmente funcional       |
| Persistência Offline     | ✅ Completo  | Com confirmações           |
| Sistema de Grupos        | ✅ Completo  | Com convites e líder       |
| Tópico ID_Control        | 🟡 Parcial   | Funcionalidade distribuída |
| Sessões com ID Único     | 🔴 Faltante  | Não implementado           |
| Tópico USERS             | 🟢 Melhorado | Funcionalidade equivalente |

**Conformidade Geral**: ~75% (considerando melhorias como implementações válidas)

**Conformidade Estrita**: ~60% (considerando apenas especificação literal)
