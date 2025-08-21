# MQTT Chat

Este projeto foi desenvolvido para a matéria de Tópicos Especiais em Computação XIII.

Para iniciar, garanta que você tem os programas nesessários instalados. Rode `setup.sh` na sua máquina. Aqui estaremos cobrindo apenas para Linux, se você utiliza Windows, o processo pode ser diferente em algum ponto.

```sh
chmod +x setup-gex635.sh && ./setup-gex635.sh
```

## O que ocorre ao executar `setup.sh`

1. São instaladas as seguintes ferramentas:

- **Desenvolvimento:** build-essential, cmake, gcc, g++, make, gdb
- **Editores:** vim, nano
- **Utilitários:** git, wget, curl, tree
- **MQTT:** mosquitto (broker), mosquitto-clients, libpaho-mqtt-dev
- **Bibliotecas:** libssl-dev, libncurses5-dev, libsqlite3-dev

2. O broker mosquitto é configurado

3. A estutura inicial do projeto é configurada (aqui atualizar pra trazer tudo pro git)

