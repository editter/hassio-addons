/**
 * @author Eric Ditter
 * @file Hassio addon that polls Life360 API for location changes as
 *       well as listens via webhook for life360 initiated changes.
 */

import { Circle, Member, Place, PlacesRequest, CirclesRequest, TokenRequest, MembersRequest, Location } from './life360';

import * as winston from 'winston';

import * as mqtt from 'mqtt';
import * as async from 'async';
import * as jsonfile from 'jsonfile';
import * as fs from 'fs';
import * as path from 'path';
import Axios from 'axios';
import { Response, Request, NextFunction, json } from 'express';
import { v4 } from 'uuid';
// import { map } from 'async';
import { MqttClient } from 'mqtt';
const baseAuthKey = 'cFJFcXVnYWJSZXRyZTRFc3RldGhlcnVmcmVQdW1hbUV4dWNyRUh1YzptM2ZydXBSZXRSZXN3ZXJFQ2hBUHJFOTZxYWtFZHI0Vg==';

const CONFIG_DIR = process.env.CONFIG_DIR || './data',
  STATE_FILE = path.join(CONFIG_DIR, 'state.json'),
  OPTIONS_FILE = path.join(CONFIG_DIR, 'options.json'),
  CURRENT_VERSION: string = jsonfile.readFileSync(path.join('package.json')).version,
  isProd = process.env.IS_PROD === 'true',
  PORT = 8081,
  baseUrl = 'https://api.life360.com/v3',
  config = jsonfile.readFileSync(OPTIONS_FILE) as {
    mqtt_host: string;
    mqtt_port: number;
    mqtt_username: string;
    mqtt_password: string;
    preface: string;
    cert_file: string;
    key_file: string;
    host_url: string;
    life360_user: string;
    life360_password: string;
    refresh_minutes: number;
    process_type: 'MQTT' | 'HTTP',
    user_device_map: { life360_name: string, known_devices_name: string }[]
  },
  state = loadSavedState({
    saved_token: null as string | null,
    circles: [] as { id: string, name: string }[],
    history: {},
    members: [] as Member[],
    places: [] as Place[],
    access_token: v4(),
    CURRENT_VERSION
  });

let client: MqttClient | null = null;
config.process_type = <any>config.process_type.toUpperCase();
if (config.process_type === 'MQTT') {
  const url = config.mqtt_host.includes('://') ? config.mqtt_host : `mqtt://${config.mqtt_host}`;
  client = mqtt.connect(url, {
    username: config.mqtt_username,
    password: config.mqtt_password,
    port: config.mqtt_port,
  });
} else if (config.process_type === 'HTTP') {
  if (!config.user_device_map || config.user_device_map.length === 0) {
    winston.error(`When using HTTP you must have a value in user_device_map`);
    process.exit(1);
  }
} else {
  winston.error(`process_type must be either MQTT or HTTP. ${config.process_type} is invalid`);
  process.exit(1);
}

function isServer() {
  return config.host_url && config.host_url.length > 0 && config.cert_file.length > 0 && config.key_file.length > 0;
}

winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
  timestamp: () => {
    const
      date = new Date(),
      month = date.getMonth() + 1,
      day = date.getDate(),
      hour = date.getHours(),
      minute = date.getMinutes(),
      second = date.getSeconds(),
      hourFormatted = hour % 12 || 12,
      minuteFormatted = minute < 10 ? '0' + minute : minute,
      morning = hour < 12 ? 'am' : 'pm';

    return `${month}/${day} ${hourFormatted}:${minuteFormatted}:${second} ${morning}`;
  }
});

function loadSavedState<T>(defaults: T): T {
  try {
    const savedState = jsonfile.readFileSync(STATE_FILE);
    if (savedState.CURRENT_VERSION !== CURRENT_VERSION) {
      return defaults;
    }
    return savedState;
  } catch (ex) {
    winston.info('No previous state found, setting to defaults.');
    return defaults;
  }

}

async function refreshToken() {

  const headers = {
    headers: {
      Authorization: 'basic ' + baseAuthKey
    }
  };
  const authResponse = await Axios.post<TokenRequest>(`${baseUrl}/oauth2/token.json`, {
    grant_type: 'password',
    username: config.life360_user,
    password: config.life360_password
  }, headers);

  if (authResponse.data.access_token) {
    state.saved_token = authResponse.data.token_type + ' ' + authResponse.data.access_token;
  } else {
    throw Error('No token was returned. ' + authResponse.data.errorMessage);
  }

  headers.headers = {
    Authorization: state.saved_token
  };
  const circleResponse = await Axios.get<CirclesRequest>(`${baseUrl}/circles.json`, headers);
  if (Array.isArray(circleResponse.data.circles)) {
    state.circles = [];
    circleResponse.data.circles.forEach(circ => {
      state.circles.push({
        id: circ.id,
        name: circ.name
      });

    });

  } else {
    winston.warn('No circles were returned from the request. ' + circleResponse.data.errorMessage);
  }

  return new Promise<void>((accept, reject) => {
    state.places = [];

    async.forEach(state.circles, async (circ, callback) => {
      const placesResponse = await Axios.get<PlacesRequest>(`${baseUrl}/circles/${circ.id}/places.json`, headers);
      if (Array.isArray(placesResponse.data.places)) {
        placesResponse.data.places.forEach(x => state.places.push(x));
      }

      if (isServer()) {
        await Axios.delete(`${baseUrl}/circles/${circ.id}/webhook.json`, headers);
        const returnUrl = config.host_url + '/webhook?access_token=' + state.access_token;
        const webhookResponse = await Axios.post(`${baseUrl}/circles/${circ.id}/webhook.json`, {
          url: returnUrl
        }, headers);

        if (!webhookResponse.data.hookUrl) {
          winston.warn('Webhook was not created. ' + circleResponse.data.errorMessage);
        }
      } else {
        winston.warn('No Webhook created because url or certs were not set');
      }
      callback();
    }, (err) => {
      if (err) {
        reject(err);

      } else {
        accept();

      }
    });

  });

}

function formatLocation(input: Member) {
  const location = input && input.location ? input.location : null;
  if (!location) {
    return null;
  }
  if (config.process_type === 'MQTT') {

    return {
      longitude: parseFloat(location.longitude),
      latitude: parseFloat(location.latitude),
      gps_accuracy: parseInt(location.accuracy, 0),
      battery_level: parseInt(location.battery, 0),
      name: input.firstName,
      speed: location.speed,
      is_driving: parseInt(location.isDriving, 0),
      is_intransit: parseInt(location.inTransit, 0),
      is_charging: parseInt(location.charge, 0),
      wifi_state: parseInt(location.wifiState, 0),
      address1: location.address1,
      address2: location.address2,
    };

  } else if (config.process_type === 'HTTP') {

    const user = config.user_device_map.filter(x => x.life360_name.toUpperCase() === input.firstName.toUpperCase());
    return {
      dev_id: user.length > 0 ? user[0].known_devices_name : input.firstName,
      gps: [parseFloat(location.latitude), parseFloat(location.longitude)],
      gps_accuracy: parseInt(location.accuracy, 0),
      battery: parseInt(location.battery, 0),
      attributes: {
        speed: location.speed,
        is_driving: parseInt(location.isDriving, 0),
        is_intransit: parseInt(location.inTransit, 0),
        is_charging: parseInt(location.charge, 0),
        wifi_state: parseInt(location.wifiState, 0),
        address1: location.address1,
        address2: location.address2,
      },
      // friendly_name: input.firstName
    };

  }

  throw Error('Invalid process_type');
}

async function refreshState() {
  const topic = `${config.preface}/location`;

  try {
    state.members = await getData();
    const data = state.members.map(x => formatLocation(x));
    state.history = data;
    jsonfile.writeFileSync(STATE_FILE, state, {
      spaces: 2
    });
    data.forEach(msg => {
      if (!msg) {
        return;
      }
      if (config.process_type === 'MQTT') {

        if (client !== null) {
          const userTopic = `${topic}/${msg.name}`;
          winston.info('MQTT Message was written to ' + userTopic);
          client.publish(userTopic, JSON.stringify(msg), {
            qos: 1,
            retain: true
          });
        }
      } else if (config.process_type === 'HTTP') {
        winston.info('HTTP Message sent for ' + msg.dev_id);
        const conf = {
          headers: {
            'X-HASSIO-KEY': process.env.HASSIO_TOKEN
          }
        };
        Axios.post('http://hassio/homeassistant/api/services/device_tracker/see', msg, conf).catch(err => winston.error(err));

      }
    });



  } catch (err) {
    winston.error(err);
  }
}

async function getData() {
  if (!state.saved_token) {
    await refreshToken();
  }

  return new Promise<Member[]>((accept, reject) => {
    const headers = {
      headers: {
        Authorization: state.saved_token || 'un-auth-request'
      }
    };
    const results: Member[] = [];
    async.forEach(state.circles, (circ, callback) => {
      Axios.get<MembersRequest>(`${baseUrl}/circles/${circ.id}/members.json`, headers)
        .then(membersResponse => {
          membersResponse.data.members.forEach(x => results.push(x));
          callback();
        })
        .catch(err => {
          if (err.status === 401) {
            state.saved_token = null;
          }
          callback(err);
        });
    }, (err) => {
      if (err) {
        reject(err);

      } else {
        accept(results);

      }
    });
  });
}

// main flow
async.series([
  function init(next) {
    refreshToken().then(() => {
      winston.info('init/refresh token successful');
      next();

    }).catch(err => {
      winston.error('Error getting initial token request. Ending process');
      next(err);

    });

  },
  function configurePolling(next) {
    const interval = 60 * 1000 * config.refresh_minutes;
    winston.info(`Configuring auto update for every ${config.refresh_minutes} minutes`);

    // save current state every 15 minutes
    setInterval(refreshState, interval);

    refreshState().then(x => {
      state.circles.forEach((circle, i, arr) => {
        winston.info(`Circle ${i + 1} of ${arr.length}: ${circle.name}`);
      });

      state.members.forEach((member, i, arr) => {
        const memberData = formatLocation(member);
        winston.info(`Member ${i + 1} of ${arr.length}\n Name: ${member.firstName}; Data: ${JSON.stringify(memberData, null, 4)} `);

      });
    });

    process.nextTick(next);
  },
  async function setupApp(next) {
    if (isServer()) {
      winston.info('Configuring server');
      const express = await import('express');
      const https = await import('https');
      // const expressWinston: any = await import('express-winston');
      const bodyparser = await import('body-parser');
      const app = express();

      app.use(bodyparser.json());

      // webhook event from life360
      app.all('/webhook', async (req, res, n) => {
        if (req.query.access_token === state.access_token) {
          winston.info('Webhook call received with valid access token');

          await refreshState();
          return res.send('ok').end();
        } else {
          winston.info('Webhook call was made with invalid access token');
          return res.send('Webhook is visible externally').end();

        }

      });

      app.use((err: any, req: Request, res: Response, n: NextFunction) => {
        winston.error(err);

        return res.status(500).send({
          errorMessage: 'An unhandled error occured'
        });
      });
      if (isProd) {
        winston.info('Listing via https');
        const options = {
          cert: fs.readFileSync(path.join('/ssl/', config.cert_file)),
          key: fs.readFileSync(path.join('/ssl/', config.key_file))
        };
        https.createServer(options, app as any).listen(PORT, next);
      } else {
        app.listen(PORT, next);
      }
      winston.info('Listening at port %s', PORT);
    }
    // accept JSON




  }
], (error) => {
  if (error) {
    return winston.error(<any>error);
  }
});
