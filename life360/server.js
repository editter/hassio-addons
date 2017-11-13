/*eslint quotes: [2, single"]*/
/*eslint-env es6*/
/*jslint esversion: 6 */

// 'use strict';

const winston = require('winston'),
  express = require('express'),
  https = require('https'),
  // expressJoi = require('express-joi-validator'),
  expressWinston = require('express-winston'),
  bodyparser = require('body-parser'),
  mqtt = require('mqtt'),
  async = require('async'),
  path = require('path'),
  // rl = require('url'),
  // joi = require('joi'),
  // aml = require('js-yaml'),
  jsonfile = require('jsonfile'),
  fs = require('fs'),
  Axios = require('axios');
// import async from 'async';
// import Axios from 'axios';

const baseAuthKey = 'cFJFcXVnYWJSZXRyZTRFc3RldGhlcnVmcmVQdW1hbUV4dWNyRUh1YzptM2ZydXBSZXRSZXN3ZXJFQ2hBUHJFOTZxYWtFZHI0Vg==';

const CONFIG_DIR = process.env.CONFIG_DIR || '/data',
  STATE_FILE = path.join(CONFIG_DIR, 'state.json'),
  EVENTS_LOG = path.join(CONFIG_DIR, 'events.log'),
  ACCESS_LOG = path.join(CONFIG_DIR, "access.log"),
  ERROR_LOG = path.join(CONFIG_DIR, 'error.log'),
  OPTIONS = path.join(CONFIG_DIR, 'options.json'),
  CURRENT_VERSION = jsonfile.readFileSync(path.join('package.json')).version,
  PORT = 8081;


let config = jsonfile.readFileSync(CONFIG_DIR),
  state = loadSavedState({
    savedToken: null,
    circles: [
      /*{
            id: '',
            name: null,
          }*/
    ],
    queueHistory: {},
    members: [],
    places: [],
    CURRENT_VERSION
  });

// write all events to disk as well
winston.add(winston.transports.File, {
  filename: EVENTS_LOG,
  json: false
});
const url = config.mqttHost.includes('://') ? config.mqttHost : `mqtt://${config.mqttHost}`;

const app = express(),
  client = mqtt.connect(`${url}:${config.mqttPort}`, {
    username: config.mqttUsername,
    password: config.mqttPassword
  });


function loadSavedState(defaults) {
  let output;
  try {
    output = jsonfile.readFileSync(STATE_FILE);
  } catch (ex) {
    winston.info("No previous state found, continuing " + ex.message);

    output = defaults;
  }
  return output;
}

async function refreshToken() {

  // try {
  const headers = {
    headers: {
      Authorization: "basic " + baseAuthKey
    }
  };
  const authResponse = await Axios.post("https://api.life360.com/v3/oauth2/token.json", {
    grant_type: "password",
    username: config.life360User,
    password: config.life360Password
  }, headers);

  if (authResponse.data.access_token) {
    state.savedToken = authResponse.data.token_type + " " + authResponse.data.access_token;
  } else {
    throw Error("No token was returned. " + authResponse.data.errorMessage)
  }

  headers.headers = {
    Authorization: state.savedToken
  };
  const circleResponse = await Axios.get("https://api.life360.com/v3/circles.json", headers);
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
  state.places = [];
  state.circles.forEach(async(circ) => {

    const placesResponse = await Axios.get(`https://api.life360.com/v3/circles/${circ.id}/places.json`, headers);
    if (Array.isArray(placesResponse.data.places)) {
      placesResponse.data.places.forEach(x => state.places.push(x));
    }

    if (config.life360ReturnHost && config.life360ReturnHost.length > 0) {
      await Axios.delete(`https://api.life360.com/v3/circles/${circ.id}/webhook.json`, headers);
      const returnUrl = config.life360ReturnHost + ":" + config.life360ReturnPort + "/webhook";
      const webhookResponse = await Axios.post(`https://api.life360.com/v3/circles/${circ.id}/webhook.json`, {
        url: returnUrl
      }, headers);

      if (!webhookResponse.data.hookUrl) {
        winston.warn("Webhook was not created. " + circleResponse.data.errorMessage);
      }
    }
  });

}

function formatLocation(input) {
  //  {"longitude": 1.0,"gps_accuracy": 60,"latitude": 2.0,"battery_level": 99.9}
  return {
    id: input.id,
    longitude: input.location.longitude,
    latitude: input.location.latitude,
    gps_accuracy: input.location.accuracy,
    battery_level: input.location.battery,
    short_address: input.location.shortAddress,
    is_intransit: input.location.inTransit,
    name: input.firstName
  }
}

async function refreshState() {
  const topic = `/${config.preface}/location`;

  try {
    state.members = await getData();
    const queueData = state.members.map(x => formatLocation(x));
    state.queueHistory[topic] = queueData;
    jsonfile.writeFileSync(STATE_FILE, state, {
      spaces: 2
    });

    queueData.forEach(msg => {
      const userTopic = `${topic}/${msg.name}`;
      winston.info('Message was written to ' + userTopic);
      client.publish(userTopic, JSON.stringify(msg), {
        retain: true
      });
    });

  } catch (err) {
    winston.error(err);
  }
}

async function getData() {
  let results = [];
  if (!state.savedToken) {
    await refreshToken();
  }

  const headers = {
    headers: {
      Authorization: state.savedToken || 'un-auth-request'
    }
  };

  return new Promise((accept, reject) => {
    async.forEach(state.circles, (circ, callback) => {
      Axios.get(`https://api.life360.com/v3/circles/${circ.id}/members.json`, headers)
        .then(membersResponse => {
          membersResponse.data.members.forEach(x => results.push(x));
          callback();
        })
        .catch(err => {
          if (err.status === 401) {
            state.savedToken = null;
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
        winston.error(err);
        process.exit(1);

      });

    },
    function configureCron(next) {
      winston.info("Configuring auto update");

      // save current state every 15 minutes
      setInterval(refreshState, 15 * 60 * 1000);
      refreshState();
      process.nextTick(next);
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
        const topic = `/${config.preface}/location-change`;
        const data = req.body;
        winston.info("Incoming message from Life360 Webhook: %s", JSON.stringify(data));
        state.queueHistory[topic] = data;
        client.publish(topic, JSON.stringify(data), {
          retain: true
        }, () => {
          res.send({
            status: "OK"
          });
        });
      });

      app.all("/get-recent", (req, res) => {
        const data = req.body;
        winston.info('Incoming request for location');
        const recent = state.members.map(x => formatLocation(x)).filter(x => x.name === data.name);
        let response = '';
        if (recent.length > 0) {
          // respond with name is at recent[0].short_address
          const person = recent[0];
          response = `${data.name} is ${person.is_inTransit===0 ? 'moving near':'at'} ${person.short_address}`;
        } else {
          // respond with I couldnt find name
          response = `I could not find ${data.name}`
        }

        res.send(response).end();
      });

      app.get('/check', (req, res, next) => {

        res.send('Content Visible.  You are able').end();
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
      app.use((err, req, res, next) => {
        winston.error(err);

        res.status(500).send({

          errorMessage: 'An unhandled error occured'

        });
      });
      if (config.certFile.length > 0 && config.keyFile.length > 0) {
        winston.info('Certificate files found, listing via https');
        const options = {
          cert: fs.readFileSync(path.join('/ssl/', config.certFile)),
          key: fs.readFileSync(path.join('/ssl/', config.keyFile))
        };
        https.createServer(options, app).listen(PORT, next);

      } else {
        winston.info('NO certificate files found, listing via http');
        app.listen(PORT, next);
      }
    }
  ],
  (error) => {
    if (error) {
      return winston.error(error);
    }
    winston.info("Listening at port %s", PORT);
  });