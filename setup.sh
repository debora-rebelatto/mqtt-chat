cat > setup.sh << 'EOF'
#!/bin/bash
set -e
echo "🚀 Instalando ambiente MQTT"

sudo apt update

sudo apt install -y \
    curl \
    git \
    mosquitto \     
    mosquitto-clients

echo "listener 1883 0.0.0.0" | sudo tee -a /etc/mosquitto/conf.d/default.conf
echo "allow_anonymous true" | sudo tee -a /etc/mosquitto/conf.d/default.conf

sudo systemctl enable mosquitto
sudo systemctl restart mosquitto

curl -fsSL https://bun.sh/install | bash
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

echo "✅ Verificando instalações..."
which bun
mosquitto -v
echo "mosquitto status: $(sudo systemctl is-active mosquitto)"

# Teste rápido do broker MQTT
echo "🧪 Testando broker MQTT..."
timeout 5s mosquitto_sub -h localhost -t "test/install" -v &
sleep 2
mosquitto_pub -h localhost -t "test/install" -m "✅ MQTT funcionando!" || true

echo "🎉 Instalação concluída!"
echo "🚀 Para começar:"
echo "   cd ~/mqtt-project"
EOF