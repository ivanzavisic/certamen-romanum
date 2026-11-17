// Relay transport: both players talk through a public MQTT broker over secure
// WebSockets. Unlike direct WebRTC this works across any home/mobile network,
// because each browser only makes an ordinary outgoing wss:// connection.
import mqtt from 'mqtt';
import { log } from './log.svelte.js';

export const BROKERS = [
  { name: 'HiveMQ', url: 'wss://broker.hivemq.com:8884/mqtt' },
  { name: 'EMQX', url: 'wss://broker.emqx.io:8084/mqtt' },
  { name: 'Mosquitto', url: 'wss://test.mosquitto.org:8081/mqtt' },
];
const ROOT = 'certamen-romanum/v2';
const CONNECT_TIMEOUT = 6_000;

function connectOnce(idx, { inTopic, outTopic, clientId, onMessage, onStatus }) {
  const b = BROKERS[idx];
  return new Promise((resolve, reject) => {
    const started = performance.now();
    log(`connecting to relay ${b.name} (${b.url})…`);
    const client = mqtt.connect(b.url, {
      clientId,
      clean: true,
      keepalive: 20,
      connectTimeout: CONNECT_TIMEOUT,
      reconnectPeriod: 2_000,
      will: { topic: outTopic, payload: JSON.stringify({ t: 'bye', from: clientId }), qos: 1 },
    });
    let ready = false;
    const giveUp = (why) => {
      if (ready) return;
      ready = true;
      log(`relay ${b.name} failed: ${why}`);
      client.end(true);
      reject(new Error(why));
    };
    const timer = setTimeout(() => giveUp('timeout'), CONNECT_TIMEOUT + 500);

    client.on('connect', () => {
      if (!ready) {
        client.subscribe(inTopic, { qos: 1 }, (err) => {
          if (err) return giveUp('subscribe failed: ' + err.message);
          ready = true;
          clearTimeout(timer);
          log(`relay ${b.name} connected in ${Math.round(performance.now() - started)} ms, listening on …/${inTopic.split('/').slice(-2).join('/')}`);
          resolve(client);
        });
      } else {
        log(`relay ${b.name} reconnected`);
        onStatus?.('online');
      }
    });
    client.on('error', (e) => (ready ? log(`relay error: ${e.message}`) : giveUp(e.message)));
    client.on('offline', () => { if (ready) { log('relay offline — retrying…'); onStatus?.('offline'); } });
    client.on('message', (_t, buf) => {
      try { onMessage(JSON.parse(buf.toString())); } catch (e) { log('bad message: ' + e.message); }
    });
  });
}

/**
 * Open a two-way channel for one room.
 * @param {{room:string, role:'host'|'guest', broker?:number, clientId:string, onMessage:Function, onStatus?:Function}} o
 * If `broker` is not given, tries each broker in order and returns the first that works.
 */
export async function openChannel(o) {
  const inTopic = `${ROOT}/${o.room}/${o.role === 'host' ? 'g2h' : 'h2g'}`;
  const outTopic = `${ROOT}/${o.room}/${o.role === 'host' ? 'h2g' : 'g2h'}`;
  const order = o.broker != null && BROKERS[o.broker] ? [o.broker] : BROKERS.map((_, i) => i);
  for (const idx of order) {
    try {
      const client = await connectOnce(idx, { ...o, inTopic, outTopic });
      return {
        broker: idx,
        send: (msg) => client.connected && client.publish(outTopic, JSON.stringify({ ...msg, from: o.clientId }), { qos: 1 }),
        close: () => {
          try { client.publish(outTopic, JSON.stringify({ t: 'bye', from: o.clientId }), { qos: 0 }); } catch {}
          setTimeout(() => client.end(true), 150);
        },
      };
    } catch { /* try next broker */ }
  }
  const err = new Error('no relay reachable');
  err.type = 'network';
  throw err;
}
