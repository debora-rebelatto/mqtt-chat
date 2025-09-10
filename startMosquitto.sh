echo "listener 1883 0.0.0.0" | sudo tee -a /etc/mosquitto/conf.d/default.conf
echo "allow_anonymous true" | sudo tee -a /etc/mosquitto/conf.d/default.conf

sudo systemctl restart mosquitto
sudo systemctl enable mosquitto