/**
 *
 */

import { Member, Place, Circle } from './life360';

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
import * as Axios from 'axios';
import { Request, NextFunction, json } from 'express';
import { Response } from 'express-serve-static-core';
import * as guid from 'guid';
import { app as AlexaApp, request as AlexaRequest, response as AlexaResponse } from 'alexa-app';

const baseAuthKey = 'cFJFcXVnYWJSZXRyZTRFc3RldGhlcnVmcmVQdW1hbUV4dWNyRUh1YzptM2ZydXBSZXRSZXN3ZXJFQ2hBUHJFOTZxYWtFZHI0Vg==';

const CONFIG_DIR = process.env.CONFIG_DIR || './data',
  STATE_FILE = path.join(CONFIG_DIR, 'state.json'),
  OPTIONS_FILE = path.join(CONFIG_DIR, 'options.json'),
  EVENTS_LOG = path.join(CONFIG_DIR, 'events.log'),
  ACCESS_LOG = path.join(CONFIG_DIR, "access.log"),
  ERROR_LOG = path.join(CONFIG_DIR, 'error.log'),
  CURRENT_VERSION: string = jsonfile.readFileSync(path.join('package.json')).version,
  isProd = process.env.IS_PROD === 'true',
  app = express(),
  alexaApp = new AlexaApp('alexa'),
  PORT = 8081;


let config = jsonfile.readFileSync(OPTIONS_FILE) as {
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
},
  state = loadSavedState({
    saved_token: null as string | null,
    circles: [] as { id: string, name: string }[],
    queue_history: {} as { [prop: string]: any },
    members: [] as Member[],
    places: [] as Place[],
    access_token: guid.raw(),
    CURRENT_VERSION
  });

// write all events to disk as well
winston.add(winston.transports.File, {
  filename: EVENTS_LOG,
  json: false
});
const url = config.mqtt_host.includes('://') ? config.mqtt_host : `mqtt://${config.mqtt_host}`,
  client = mqtt.connect(`${url}`, {
    username: config.mqtt_username,
    password: config.mqtt_password,
    port: config.mqtt_port,
  });


function loadSavedState<T>(defaults: T): T {
  try {
    return jsonfile.readFileSync(STATE_FILE);
  } catch (ex) {
    winston.info("No previous state found, setting to defaults.");
    return defaults;
  }

}

async function refreshToken() {

  const headers = {
    headers: {
      Authorization: "basic " + baseAuthKey
    }
  };
  const authResponse = await Axios.post<{ access_token: string, token_type: string, errorMessage?: string }>("https://api.life360.com/v3/oauth2/token.json", {
    grant_type: "password",
    username: config.life360_user,
    password: config.life360_password
  }, headers);

  if (authResponse.data.access_token) {
    state.saved_token = authResponse.data.token_type + " " + authResponse.data.access_token;
  } else {
    throw Error("No token was returned. " + authResponse.data.errorMessage)
  }

  headers.headers = {
    Authorization: state.saved_token
  };
  const circleResponse = await Axios.get<{ circles: Circle[], errorMessage?: string }>("https://api.life360.com/v3/circles.json", headers);
  if (Array.isArray(circleResponse.data.circles)) {
    state.circles = [];
    circleResponse.data.circles.forEach(circ => {
      state.circles.push({
        id: circ.id,
        name: circ.name
      });

    });

  } else {
    winston.warn("No circles were returned from the request. " + circleResponse.data.errorMessage);
  }

  return new Promise<void>((accept, reject) => {
    state.places = [];

    async.forEach(state.circles, async (circ, callback) => {
      const placesResponse = await Axios.get<{ places: Place[], errorMessage: string }>(`https://api.life360.com/v3/circles/${circ.id}/places.json`, headers);
      if (Array.isArray(placesResponse.data.places)) {
        placesResponse.data.places.forEach(x => state.places.push(x));
      }

      if (config.host_url && config.host_url.length > 0) {
        await Axios.delete(`https://api.life360.com/v3/circles/${circ.id}/webhook.json`, headers);
        const returnUrl = config.host_url + "/webhook?access_token=" + state.access_token;
        const webhookResponse = await Axios.post(`https://api.life360.com/v3/circles/${circ.id}/webhook.json`, {
          url: returnUrl
        }, headers);

        if (!webhookResponse.data.hookUrl) {
          winston.warn("Webhook was not created. " + circleResponse.data.errorMessage);
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
    gps_accuracy: parseInt(input.location.accuracy),
    battery_level: parseInt(input.location.battery),
    is_intransit: parseInt(input.location.inTransit),
    address1: input.location.address1,
    name: input.firstName
  }
}

async function refreshState() {
  const topic = `/${config.preface}/location`;

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
      client.publish(userTopic, JSON.stringify(msg), { qos: 1, retain: true });
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

    let results: Member[] = [];
    async.forEach(state.circles, (circ, callback) => {
      Axios.get<{ members: Member[] }>(`https://api.life360.com/v3/circles/${circ.id}/members.json`, headers)
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
      next(err)

    });

  },
  function configurePolling(next) {
    winston.info("Configuring auto update");

    // save current state every 15 minutes
    setInterval(refreshState, 15 * 60 * 1000);
    refreshState();
    process.nextTick(next);
  },
  function alexaSkill(next) {
    winston.info("Configuring alexa skill");
    alexaApp.express({ expressApp: app, debug: true });
    alexaApp.pre = (request, response, type) => {
      winston.info(JSON.stringify(request.getSession().details));
    }

    alexaApp.intent('GetPosition', {
      slots: { "NAME": "AMAZON.US_FIRST_NAME" },
      utterances: [
        "where is {NAME}",
        "where is {NAME} right now",
        "what is the location of {NAME}",
      ]
    }, (request, response) => {
      const slotName = request.slot('NAME')
      winston.info(`Incoming request for alexa location name='${name}'`);
      refreshState();
      const recent = state.members.map(x => formatLocation(x)).filter(x => x.name === slotName);
      let message = '';
      if (recent.length > 0) {
        // respond with name is at recent[0].short_address
        const person = recent[0];
        message = `${slotName} is ${person.is_intransit === 0 ? 'moving near' : 'at'} ${person.address1}`;
      } else {
        // respond with I couldnt find name
        message = `I could not find ${slotName}`
      }
      response.say(message);
    });

    next();
  },
  function setupApp(next) {
    winston.info("Configuring server");

    // accept JSON
    app.use(bodyparser.json());

    // log all requests to disk
    app.use(expressWinston.logger({
      transports: [
        new winston.transports.File({
          filename: ACCESS_LOG,
          json: false
        })
      ]
    }));

    // webhook event from life360
    app.all("/webhook", (req, res) => {
      winston.info('Webhook call received' + JSON.stringify(req.params) + JSON.stringify(req.headers));
      // if (req.headers["access_token"] === state.access_token) {
      //   return res.status(401).send({ errorMessage: "Invalid access token" }).end();
      // }
      refreshState();
    });



    app.get('/check', (req, res, next) => {
      let output = "Life 360 Plugin";
      output += "<style>h3{margin-bottom:0}</style>"
      output += "<h3>Places</h3><br />"
      output += "<pre><code>";
      output += JSON.stringify(state.places.map(x => new Object({
        name: x.name,
        latitude: x.latitude,
        longitude: x.longitude,
        radius: x.radius
      })), null, 4);
      output += "</code></pre>";
      output += "<h3>Circles</h3><br />"
      output += "<pre><code>";
      output += JSON.stringify(state.circles.map(x => new Object({
        name: x.name
      })), null, 4);
      output += "</code></pre>";
      output += "<h3>Circles</h3><br />"
      output += "<pre><code>";
      output += JSON.stringify(state.members.map(x => formatLocation(x)), null, 4);
      output += "</code></pre>";
      output += "<h3>Alexa Skill Builder</h3><br />";
      output += "<pre><code>";
      output += JSON.stringify(alexaApp.schemas.skillBuilder(), null, 4);
      output += "</code></pre>";
      res.send(output).end();
    });

    // log all errors to disk
    app.use(expressWinston.errorLogger({
      transports: [
        new winston.transports.File({
          filename: ERROR_LOG,
          json: false
        })
      ]
    }));

    // proper error messages with Joi
    app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      winston.error(err);

      res.status(500).send({
        errorMessage: 'An unhandled error occured'
      });
    });

    if (isProd === true && (config.cert_file.length === 0 || config.key_file.length === 0)) {
      next('SSL Certs are required because this addon receives data from a third party so we want their data safely');

    } else if (isProd === false) {
      winston.info('NO certificate files found, listing via http');
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
  winston.info("Listening at port %s", PORT);
});