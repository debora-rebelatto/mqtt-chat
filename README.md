# Mqtt Chat App

Sistema de chat em tempo real utilizando protocolo MQTT, desenvolvido em Angular com TypeScript. A aplicação permite comunicação um-a-um e em grupo, com interface web moderna e persistência de dados para usuários offline.

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

5. Instalar o Bun.js (Linux):

```bash
curl -fsSL https://bun.sh/install | bash
```

6. Instalar o Angular:

```bash
npm install -g @angular/cli
```

7. Instalar as dependências:

```bash
bun install
```

8. Clonar o repositório

```bash
git clone https://github.com/debora-rebelatto/mqtt-chat.git
```

9. Rodar o projeto:

```bash
cd mqtt-chat
bun start
```

Quando o servidor estiver rodando, abra seu navegador e navegue para `http://localhost:4200/`. A aplicação vai fazer reload automaticamente quando você mudar qualquer coisa do código fonte.

Para mais detalhes, consulte DOCUMENTACAO.md.
