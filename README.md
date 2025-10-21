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

Para mais detalhes, consulte DOCUMENTACAO.md
