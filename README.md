# Mqtt Chat App

## Informações

- Disciplina: GEX635 - TÓPICOS ESPECIAIS EM COMPUTAÇÃO XIII
- Período: 2025.2
- Autor: Débora Rebelatto e Bruno de Macedo Sanagiotto
- Tecnologia: Angular + TypeScript + MQTT (Paho)

## PRÉ-REQUISITOS:

- Bun 1.2
- Angular CLI 20
- Broker MQTT (Mosquitto) configurado para WebSockets

## INSTALAÇÃO DO BROKER MQTT:

1. Instalar Mosquitto:

```bash
sudo apt-get install mosquitto mosquitto-clients
```

2. Configurar WebSocket (criar arquivo mosquitto.conf):

```bash
listener 8081
protocol websockets
allow_anonymous true
```

3. Iniciar broker:

```bash
sudo systemctl start mosquitto
```

4. Verificar status:

```bash
sudo systemctl status mosquitto
```

## Development server

To start a local development server, run:

```bash
bun run start
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## UTILIZAÇÃO:

1. Inserir nome de usuário na tela inicial
2. Para chat individual: selecionar usuário na lista lateral
3. Para criar grupo: usar formulário "Criar Grupo"
4. Para entrar em grupo: solicitar entrada via "Procurar Grupos"
5. Para aceitar convites: usar painel de notificações (sino)

## TÓPICOS MQTT UTILIZADOS:

- meu-chat-mqtt/status (status de usuários)
- meu-chat-mqtt/messages/{userId} (mensagens individuais)
- meu-chat-mqtt/messages/groups (mensagens de grupo)
- meu-chat-mqtt/groups (informações de grupos)
- meu-chat-mqtt/invitations/requests (convites)
- meu-chat-mqtt/invitations/responses (respostas)
- meu-chat-mqtt/group-updates/{userId} (notificações)

ESTRUTURA DO PROJETO:

```bash
src/app/
├── components/     # Componentes reutilizáveis
├── features/       # Funcionalidades principais
├── models/         # Classes de domínio
├── services/       # Lógica de negócio
└── pipes/         # Pipes customizados
```

OBSERVAÇÕES:

- Broker MQTT deve estar rodando em localhost:8081
- Aplicação salva dados no localStorage do navegador
- Interface otimizada para navegadores modernos

Para mais detalhes, consulte DOCUMENTACAO.md
