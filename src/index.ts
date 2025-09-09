const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://test.mosquitto.org');

client.on('connect', () => {
  client.subscribe('presence', (err: any) => {
    if (!err) {
      client.publish('presence', 'Hello mqtt');
    }
  });
});

client.on('message', (topic: any, message: { toString: () => any }) => {
  console.log(message.toString());
  client.end();
});
