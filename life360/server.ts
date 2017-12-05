/**
 * @author Eric Ditter
 * @file Hassio addon that polls Life360 API for location changes as
 *       well as listens via webhook for life360 initiated changes.
 */

import { Circle, Member, Place, PlacesRequest, CirclesRequest, TokenRequest, MembersRequest } from './life360';

import * as winston from 'winston';
import * as express from 'express';
import * as https from 'https';
const expressWinston: any = require('express-winston');
import * as bodyparser from 'body-parser';
import * as mqtt from 'mqtt';
import * as async from 'async';
import * as jsonfile from 'jsonfile';
import * as fs from 'fs';
import * as path from 'path';
import Axios from 'axios';
import { Response, Request, NextFunction, json } from 'express';
import { v4 } from 'uuid';
const baseAuthKey = 'cFJFcXVnYWJSZXRyZTRFc3RldGhlcnVmcmVQdW1hbUV4dWNyRUh1YzptM2ZydXBSZXRSZXN3ZXJFQ2hBUHJFOTZxYWtFZHI0Vg==';

const CONFIG_DIR = process.env.CONFIG_DIR || './data',
  STATE_FILE = path.join(CONFIG_DIR, 'state.json'),
  OPTIONS_FILE = path.join(CONFIG_DIR, 'options.json'),
  // EVENTS_LOG = path.join(CONFIG_DIR, 'events.log'),
  // ACCESS_LOG = path.join(CONFIG_DIR, 'access.log'),
  // ERROR_LOG = path.join(CONFIG_DIR, 'error.log'),
  CURRENT_VERSION: string = jsonfile.readFileSync(path.join('package.json')).version,
  isProd = process.env.IS_PROD === 'true',
  app = express(),
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
  },
  state = loadSavedState({
    saved_token: null as string | null,
    circles: [] as { id: string, name: string }[],
    queue_history: {} as { [prop: string]: any },
    members: [] as Member[],
    places: [] as Place[],
    access_token: v4(),
    CURRENT_VERSION
  }),
  url = config.mqtt_host.includes('://') ? config.mqtt_host : `mqtt://${config.mqtt_host}`,
  client = mqtt.connect(`${url}`, {
    username: config.mqtt_username,
    password: config.mqtt_password,
    port: config.mqtt_port,
  });

winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
  timestamp: () => {
    const
      date = new Date(),
      // year = date.getFullYear(),
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
// winston.add(winston.transports.File, {
//   filename: EVENTS_LOG,
//   json: false
// });

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

      if (config.host_url && config.host_url.length > 0) {
        await Axios.delete(`${baseUrl}/circles/${circ.id}/webhook.json`, headers);
        const returnUrl = config.host_url + '/webhook?access_token=' + state.access_token;
        const webhookResponse = await Axios.post(`${baseUrl}/circles/${circ.id}/webhook.json`, {
          url: returnUrl
        }, headers);

        if (!webhookResponse.data.hookUrl) {
          winston.warn('Webhook was not created. ' + circleResponse.data.errorMessage);
        }
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
  return {
    longitude: parseFloat(input.location.longitude),
    latitude: parseFloat(input.location.latitude),
    gps_accuracy: parseInt(input.location.accuracy, 0),
    battery_level: parseInt(input.location.battery, 0),
    is_intransit: parseInt(input.location.inTransit, 0),
    address: input.location.address1,
    name: input.firstName
  };
}

async function refreshState() {
  const topic = `${config.preface}/location`;

  try {
    state.members = await getData();
    const queueData = state.members.map(x => formatLocation(x));
    state.queue_history[topic] = queueData;
    jsonfile.writeFileSync(STATE_FILE, state, {
      spaces: 2
    });

    queueData.forEach(msg => {
      const userTopic = `${topic}/${msg.name}`;
      winston.info('Message was written to ' + userTopic);
      client.publish(userTopic, JSON.stringify(msg), {
        qos: 1,
        retain: true
      });
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
    winston.info(`Configuring auto update for every ${interval} minutes`);

    // save current state every 15 minutes
    setInterval(refreshState, interval);
    refreshState();
    process.nextTick(next);
  },
  function setupApp(next) {
    winston.info('Configuring server');

    // accept JSON
    app.use(bodyparser.json());

    // log all requests to disk
    // app.use(expressWinston.logger({
    //   transports: [
    //     new winston.transports.File({
    //       filename: ACCESS_LOG,
    //       json: false
    //     })
    //   ]
    // }));

    // webhook event from life360
    app.all('/webhook', async (req, res) => {
      if (req.query.access_token === state.access_token) {
        winston.info('Webhook call received with valid access token');

        await refreshState();
        res.send('ok').end();
      } else {
        winston.info('Webhook call was made with invalid access token');
        res.send('Webhook is visible externally').end();

      }
    });



    // app.get('/check', (req, res) => {
    //   let output = 'Life 360 Plugin';
    //   output += '<style>h3{margin-bottom:0}</style>';
    //   output += '<h3>Places</h3><br />';
    //   output += '<pre><code>';
    //   output += JSON.stringify(state.places.map(x => new Object({
    //     name: x.name,
    //     latitude: x.latitude,
    //     longitude: x.longitude,
    //     radius: x.radius
    //   })), null, 4);
    //   output += '</code></pre>';
    //   output += '<h3>Circles</h3><br />';
    //   output += '<pre><code>';
    //   output += JSON.stringify(state.circles.map(x => new Object({
    //     name: x.name
    //   })), null, 4);
    //   output += '</code></pre>';
    //   output += '<h3>Members</h3><br />';
    //   output += '<pre><code>';
    //   output += JSON.stringify(state.members.map(x => formatLocation(x)), null, 4);
    //   output += '</code></pre>';
    //   res.send(output).end();
    // });

    // log all errors to disk
    // app.use(expressWinston.errorLogger({
    //   transports: [
    //     new winston.transports.File({
    //       filename: ERROR_LOG,
    //       json: false
    //     })
    //   ]
    // }));

    app.use((err: any, req: Request, res: Response) => {
      winston.error(err);

      res.status(500).send({
        errorMessage: 'An unhandled error occured'
      });
    });

    if (isProd === true && (config.cert_file.length === 0 || config.key_file.length === 0)) {
      next('cert_file and key_file are required');

    } else if (isProd === false) {
      winston.info('No certificate files found, listing via http');
      app.listen(PORT, next);

    } else {
      winston.info('Listing via https');
      const options = {
        cert: fs.readFileSync(path.join('/ssl/', config.cert_file)),
        key: fs.readFileSync(path.join('/ssl/', config.key_file))
      };
      https.createServer(options, app as any).listen(PORT, next);

    }

  }
], (error) => {
  if (error) {
    return winston.error(<any>error);
  }
  winston.info('Listening at port %s', PORT);
});
