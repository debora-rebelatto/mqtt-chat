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

8. Rodar o projeto:
```bash
bun start
```

Quando o servidor estiver rodando, abra seu navegador e navegue para  `http://localhost:4200/`. A aplicação vai fazer reload automaticamente quando você mudar qualquer coisa do código fonte.

Para mais detalhes, consulte DOCUMENTACAO.md.
