cat > setup-gex635.sh << 'EOF'
#!/bin/bash
set -e
echo "🚀 Instalando ambiente MQTT..."

# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar tudo necessário em um comando
sudo apt install -y \
    build-essential cmake git wget curl vim nano tree \
    libssl-dev gcc g++ make gdb \
    mosquitto mosquitto-clients mosquitto-dev \
    libpaho-mqtt-dev \
    libncurses5-dev sqlite3 libsqlite3-dev

# Configurar Mosquitto
sudo systemctl enable mosquitto
sudo systemctl start mosquitto

# Criar projeto
mkdir -p ~/gex635-mqtt/{src,docs,tests,examples}

# Exemplo básico
cat > ~/gex635-mqtt/examples/test.c << 'EOC'
#include <stdio.h>
#include <MQTTClient.h>
int main() {
    printf("✅ Paho MQTT C instalado corretamente!\n");
    return 0;
}
EOC

# Compilar teste
cd ~/gex635-mqtt/examples
gcc -o test test.c -lpaho-mqtt3c && ./test

echo "🎉 Instalação concluída! Projeto em ~/gex635-mqtt/"
EOF

chmod +x setup-gex635.sh && ./setup-gex635.sh