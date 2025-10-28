# MANUAL DO USUÁRIO - MQTT CHAT

## Sumário
1. [Introdução](#introdução)
2. [Primeiros Passos](#primeiros-passos)
3. [Interface Principal](#interface-principal)
4. [Chat Individual](#chat-individual)
5. [Grupos de Chat](#grupos-de-chat)
6. [Sistema de Notificações](#sistema-de-notificações)
7. [Configurações](#configurações)
8. [Solução de Problemas](#solução-de-problemas)

---

## Introdução

O MQTT Chat é uma aplicação de mensagens instantâneas que utiliza o protocolo MQTT para comunicação em tempo real. Desenvolvido para ser leve e eficiente, oferece conversas individuais e em grupo com sincronização em tempo real.

### Características Principais
- ⚡ **Comunicação em tempo real** via protocolo MQTT
- 💬 **Chat individual** entre usuários
- 👥 **Grupos de chat** com sistema de convites
- 🔄 **Sincronização automática** entre dispositivos
- 🔔 **Notificações em tempo real**
- 🌐 **Status online/offline** dos usuários
- 📱 **Interface responsiva** para desktop e mobile

---

## Primeiros Passos

### 1. Acessando a Aplicação
1. Abra seu navegador web
2. Acesse: `http://localhost:4200`
3. A tela de login será exibida

### 2. Fazendo Login
![Tela de Login](assets/login-screen.png)

1. **Digite seu nome de usuário** no campo "Nome de usuário"
   - Use apenas letras, números, hífen (-) e underscore (_)
   - Exemplo: `joao123`, `maria_silva`, `user-01`
2. **Clique em "Entrar"**
3. Aguarde a conexão com o servidor MQTT
4. Quando conectado, você verá "🟢 Conectado" no cabeçalho

### 3. Primeira Configuração
- Seu status será automaticamente definido como **online**
- Outros usuários poderão ver que você está disponível
- Suas mensagens serão sincronizadas automaticamente do servidor
- Conexão automática se a sessão for perdida

---

## Interface Principal

### Layout Geral
```
┌─────────────────────────────────────────────────────────────┐
│ [🏠 MQTT Chat]           [👤 Seu Nome]    [🟢 Conectado]    │
├─────────────────┬───────────────────────────────────────────┤
│                 │                                           │
│   SIDEBAR       │           ÁREA PRINCIPAL                  │
│                 │                                           │
│ • Usuários      │     [Conversas / Grupos / Configurações] │
│ • Meus Grupos   │                                           │
│ • Procurar      │                                           │
│ • Notificações  │                                           │
│                 │                                           │
└─────────────────┴───────────────────────────────────────────┘
```

### Sidebar (Menu Lateral)

#### 🧑‍🤝‍🧑 USUÁRIOS
- Lista todos os usuários disponíveis
- **🟢 Verde:** Usuário online
- **🔴 Vermelho:** Usuário offline
- **Clique** em um usuário para iniciar conversa

#### 👥 MEUS GRUPOS
- Mostra grupos dos quais você participa
- **Clique** em um grupo para abrir o chat
- Exibe número de membros: `(3 membros)`

#### 🔍 PROCURAR
- Lista grupos disponíveis para entrada
- **Botão "Solicitar Entrada"** para pedir acesso
- Grupos onde você já é membro não aparecem aqui

#### 🔔 NOTIFICAÇÕES
- Mostra convites pendentes para grupos
- **Badge vermelho** indica número de notificações
- **Aceitar/Rejeitar** convites recebidos

---

## Chat Individual

### Iniciando uma Conversa
1. **Clique em um usuário** na seção "USUÁRIOS"
2. A área principal mostrará o chat com esse usuário
3. As mensagens são sincronizadas automaticamente com o servidor
3. **Digite sua mensagem** na caixa de texto inferior
4. **Pressione Enter** ou clique no botão ➤ para enviar

### Interface do Chat
```
┌─────────────────────────────────────────────────────────────┐
│ 💬 Chat com Maria Silva                    [🟢 Online]      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  João Silva                                    10:30        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Olá Maria! Como você está?                          │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│                                        Maria Silva  10:32   │
│    ┌─────────────────────────────────────────────────────┐  │
│    │ Oi João! Estou bem, obrigada. E você?              │  │
│    └─────────────────────────────────────────────────────┘  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ [Digite sua mensagem aqui...]                          [➤] │
└─────────────────────────────────────────────────────────────┘
```

### Recursos do Chat Individual
- **Histórico completo** de mensagens
- **Timestamps** em cada mensagem
- **Scroll automático** para novas mensagens
- **Indicador de status** do destinatário
- **Persistência** - mensagens salvas mesmo após fechar o navegador

---

## Grupos de Chat

### Criando um Grupo

#### Passo a Passo
1. **Clique em "MEUS GRUPOS"** na sidebar
2. **Clique no botão "Criar Grupo"**
3. **Preencha o formulário:**
   ```
   Nome do Grupo: [Digite o nome]
   Exemplo: "Projeto Angular", "Equipe Marketing"
   ```
4. **Clique em "Criar"**
5. Você será automaticamente o **líder** do grupo

### Entrando em um Grupo Existente

#### Como Solicitar Entrada
1. **Clique em "PROCURAR"** na sidebar
2. **Visualize os grupos disponíveis:**
   ```
   📁 Projeto Angular
   👤 Líder: João Silva
   👥 3 membros
   [Solicitar Entrada]
   ```
3. **Clique em "Solicitar Entrada"**
4. **Aguarde aprovação** do líder do grupo
5. Você receberá uma **notificação** quando for aceito

### Gerenciando Convites (Para Líderes)

#### Recebendo Solicitações
1. **Clique no ícone 🔔** (notificações)
2. **Visualize convites pendentes:**
   ```
   📩 Solicitação de Entrada
   👤 Maria Silva quer entrar no grupo "Projeto Angular"
   [Aceitar] [Rejeitar]
   ```
3. **Clique em "Aceitar"** para aprovar
4. O usuário será **automaticamente adicionado** ao grupo

### Chat em Grupo

#### Interface do Grupo
```
┌─────────────────────────────────────────────────────────────┐
│ 👥 Projeto Angular (4 membros)            [👤 Você é líder] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  João Silva (Líder)                           09:15         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Bom dia pessoal! Vamos começar a reunião?          │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│                                        Maria Silva  09:16   │
│    ┌─────────────────────────────────────────────────────┐  │
│    │ Bom dia! Estou pronta.                              │  │
│    └─────────────────────────────────────────────────────┘  │
│                                                             │
│  Pedro Santos                                  09:17        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Oi pessoal! Desculpem o atraso.                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ [Digite sua mensagem para o grupo...]                  [➤] │
└─────────────────────────────────────────────────────────────┘
```

#### Recursos do Chat em Grupo
- **Identificação do remetente** em cada mensagem
- **Indicação de líder** no nome
- **Contador de membros** no título
- **Mensagens sincronizadas** entre todos os participantes
- **Histórico compartilhado** do grupo

---

## Sistema de Notificações

### Tipos de Notificações

#### 1. Convites para Grupos
```
🔔 Notificações (2)

📩 Solicitação de Entrada
👤 Ana Costa quer entrar no grupo "Equipe Design"
⏰ Há 5 minutos
[Aceitar] [Rejeitar]

📩 Solicitação de Entrada  
👤 Carlos Lima quer entrar no grupo "Projeto Mobile"
⏰ Há 10 minutos
[Aceitar] [Rejeitar]
```

#### 2. Confirmações de Entrada
```
✅ Você foi aceito no grupo "Projeto Angular"
⏰ Há 2 minutos
```

### Gerenciando Notificações
- **Badge vermelho** no ícone 🔔 indica notificações pendentes
- **Clique no ícone** para abrir o painel
- **Aceitar/Rejeitar** convites individualmente
- Notificações **desaparecem automaticamente** após ação

---

## Configurações

### Status do Usuário
- **Online:** Definido automaticamente ao fazer login
- **Offline:** Definido automaticamente ao fechar a aplicação
- **Último visto:** Atualizado automaticamente

### Sincronização de Dados
- **Mensagens:** Sincronizadas automaticamente do servidor
- **Grupos:** Atualizados em tempo real via MQTT
- **Estado:** Mantido durante a sessão ativa

### Gerenciamento de Sessão
- **Login automático** ao reconectar
- **Sincronização** de mensagens ao retornar
- **Atualizações em tempo real** de status e mensagens

---

## Solução de Problemas

### Problemas de Conexão

#### ❌ "Desconectado" no Cabeçalho
**Possíveis Causas:**
- Broker MQTT não está rodando
- Problemas de rede
- Firewall bloqueando conexão

**Soluções:**
1. **Verifique se o broker MQTT está ativo:**
   ```bash
   netstat -an | grep 8081
   ```
2. **Reinicie o broker:**
   ```bash
   mosquitto -c mosquitto.conf
   ```
3. **Recarregue a página** do navegador

#### ❌ Mensagens Não Chegam
**Possíveis Causas:**
- Destinatário offline
- Problemas de conexão MQTT
- Atraso na sincronização

**Soluções:**
1. **Verifique status do destinatário** (deve estar 🟢 online)
2. **Aguarde a sincronização** (pode levar alguns segundos)
3. **Verifique o status da conexão** (deve mostrar "🟢 Conectado")
3. **Limpe o cache** do navegador

### Problemas com Grupos

#### ❌ Não Consigo Entrar em Grupo
**Possíveis Causas:**
- Convite não foi aceito pelo líder
- Grupo não existe mais
- Problemas de sincronização

**Soluções:**
1. **Aguarde aprovação** do líder
2. **Verifique notificações** para confirmação
3. **Tente solicitar entrada novamente**

#### ❌ Grupo Não Aparece na Lista
**Possíveis Causas:**
- Você já é membro do grupo
- Grupo foi excluído
- Cache desatualizado

**Soluções:**
1. **Verifique "MEUS GRUPOS"** - talvez você já seja membro
2. **Recarregue a página** para atualizar listas
3. **Peça ao criador** para verificar se o grupo existe

### Problemas de Performance

#### ❌ Interface Lenta
**Soluções:**
1. **Feche outras abas** do navegador
2. **Limpe dados antigos** (ver seção Configurações)
3. **Use navegador atualizado** (Chrome, Firefox, Edge)

#### ❌ Mensagens Demoram para Aparecer
**Soluções:**
1. **Verifique conexão** com internet
2. **Recarregue a página**
3. **Verifique se broker MQTT está responsivo**

### Códigos de Erro Comuns

| Erro | Significado | Solução |
|------|-------------|---------|
| `AMQJS0011E` | Cliente MQTT não conectado | Verificar broker e recarregar página |
| `Connection Lost` | Conexão perdida | Aguardar reconexão automática |
| `Invalid Topic` | Tópico MQTT inválido | Reportar bug aos desenvolvedores |
| `Message Too Large` | Mensagem muito grande | Reduzir tamanho da mensagem |

### Contato para Suporte
- **Desenvolvedor:** Débora Rebelatto
- **Email:** [seu-email@exemplo.com]
- **Repositório:** [URL do repositório GitHub]

---
## Dicas e Truques

### 💡 Produtividade
- **Use Enter** para enviar mensagens rapidamente
- **Ctrl+F5** para recarregar completamente a página
- **F12** para abrir ferramentas de desenvolvedor e ver logs

### 💡 Dicas de Uso
- **Mensagens são sincronizadas** automaticamente entre dispositivos
- **Conexão automática** se a internet cair e voltar
- **Status de entrega** mostrado ao lado das mensagens
- **Notificações** para mensagens não lidas

### 💡 Etiqueta
- **Seja respeitoso** nas conversas
- **Use linguagem apropriada** em grupos profissionais
- **Não envie spam** ou mensagens excessivas

### 💡 Segurança
- **Não compartilhe informações sensíveis** no chat
- **Use nomes de usuário apropriados**
- **Reporte comportamentos inadequados** aos administradores

---

**Versão do Manual:** 1.0  
**Data:** 08 de Outubro de 2025  
**Compatível com:** MQTT Chat v1.0
