/*eslint quotes: [2, single"]*/
/*eslint-env es6*/
/*jslint esversion: 6 */
const winston = require('winston'),
  express = require('express'),
  expressJoi = require('express-joi-validator'),
  expressWinston = require('express-winston'),
  bodyparser = require('body-parser'),
  mqtt = require('mqtt'),
  async = require('async'),
  path = require('path'),
  rl = require('url'),
  joi = require('joi'),
  aml = require('js-yaml'),
  jsonfile = require('jsonfile'),
  fs = require('fs'),
  axios = require('axios');

const baseAuthKey = 'cFJFcXVnYWJSZXRyZTRFc3RldGhlcnVmcmVQdW1hbUV4dWNyRUh1YzptM2ZydXBSZXRSZXN3ZXJFQ2hBUHJFOTZxYWtFZHI0Vg==';

const CONFIG_DIR = process.env.CONFIG_DIR || process.cwd(),
  STATE_FILE = path.join(CONFIG_DIR, 'state.json'),
  EVENTS_LOG = path.join(CONFIG_DIR, 'events.log'),
  ACCESS_LOG = path.join(CONFIG_DIR, "access.log"),
  ERROR_LOG = path.join(CONFIG_DIR, 'error.log'),
  CURRENT_VERSION = require('./package').version;

let config = require('./options') || {
    mqttHost: '172.17.0.1',
    mqttPort: 1883,
    preface: 'life360',
    mqttUsername: null,
    mqttPassword: null,
    life360ReturnHost: '',
    life360ReturnPort: 8081,
    life360User: '',
    life360Password: '',
    life360CircleNames: ['']
  },
  state = loadSavedState({
    savedToken: null,
    circles: [{
      id: '',
      name: null,
    }],
    queueHistory: {},
    data: null,
    CURRENT_VERSION
  });

// write all events to disk as well
winston.add(winston.transports.File, {
  filename: EVENTS_LOG,
  json: false
});
axios.defaults.baseURL = 'https://api.life360.com/v3/'
const app = express(),
  client = mqtt.connect(`mqtt://${config.mqttHost}:${config.mqttPort}`, {
    username: config.mqttUsername,
    password: config.mqttPassword
  });

// /**
//  * Load user configuration (or create it)
//  * @method loadConfiguration
//  * @return {Object} Configuration
//  */
// function loadConfiguration() {
//   if (!fs.existsSync(CONFIG_FILE)) {
//     winston.info('No previous configuration found, creating one');
//     fs.writeFileSync(CONFIG_FILE, fs.readFileSync(SAMPLE_FILE));
//   }

//   return yaml.safeLoad(fs.readFileSync(CONFIG_FILE).toString());
// }


function loadSavedState(defaults) {
  let output;
  try {
    output = jsonfile.readFileSync(STATE_FILE);
  } catch (ex) {
    winston.info("No previous state found, continuing");
    output = defaults;
  }
  return output;
}

async function refreshToken() {
  const headers = {
    headers: {
      Authorization: "bearer " + baseAuthKey
    }
  };
  try {
    const authResponse = await axios.post("oauth2/token.json", {
      grant_type: "password",
      username: state.username,
      password: state.password
    }, headers);

    if (authResponse.data.access_token) {
      state.savedToken = authResponse.data.token_type + " " + authResponse.data.access_token;
    } else {
      winston.warn("No token was returned. " + authResponse.data.errorMessage);
    }
  } catch (err) {
    console.error("TESTETSSET", err);
  }
  headers.headers = {
    Authorization: state.savedToken
  };
  const circleResponse = await axios.get("circles.json");
  if (Array.isArray(circleResponse.data.circles)) {
    circleResponse.data.circle.forEach(circ => {
      if (config.life360CircleNames.some(conf => conf.toLowerCase() === circ.name.toLowerCase())) {
        state.circles.publish({
          id: circ.id,
          name: circ.name
        });
      }
    })

  } else {
    winston.warn("No circles were returned from the request. " + circleResponse.data.errorMessage);
  }

  state.circles.forEach(async circ => {


    await axios.delete(`circles/${circ.id}/webhook.json`, headers);
    if (config.life360ReturnHost && config.life360ReturnHost.length > 0) {
      const returnUrl = config.life360ReturnHost + ":" + config.life360ReturnPort + "/webhook";
      const webhookResponse = await axios.post(`circles/${circ.id}/webhook.json`, {
        url: returnUrl
      }, headers);

      if (!webhookResponse.data.hookUrl) {
        winston.warn("Webhook was not created. " + circleResponse.data.errorMessage);
      }
    }
  });


}

/**
 * Resubscribe on a periodic basis
 * @method refreshState
 */
async function refreshState() {
  winston.info("Saving current state");


  state.data = await getData();
  jsonfile.writeFileSync(STATE_FILE, state, {
    spaces: 4
  });
  const topic = `/${config.preface}/data-change`;
  winston.info("Interval run: %s", state.data);
  state.queueHistory[topic] = state.data;
  client.publish(topic, state.data, {
    retain: true
  });
}

function getData() {
  let results = [];
  const headers = {
    headers: {
      Authorization: this.savedToken
    }
  };
  state.circles.forEach(async circ => {

    const membersResponse = await axios.get(`circles/${circ.id}/members.json`, headers);
    const placesResponse = await axios.get(`circles/${circ.id}/places.json`, headers);

    let request = {
      circleId: circ.id,
      circleName: circ.name,
      data: {
        members: membersResponse.data.members,
        places: placesResponse.data.places
      }
    };
    results.push(request);
  });

  return results;
}



/**
 * Handle Device Change/Push event from SmartThings
 *
 * @method handleWebhook
 *
 * @param  {Object} req
 * @param  {Object}  req.body
 * @param  {String}  req.body.circleId Circle id
 * @param  {String}  req.body.placeId Location they arrived or left
 * @param  {String}  req.body.userId User who arrived or left
 * @param  {String}  req.body.direction Direction they are travelling
 * @param  {String}  req.body.timestamp Timestamp of arrival or leaving
 * @param  {Response}  res            Result Object
 */

function handleWebhook(req, res) {
  // var topic = getTopicFor(req.body.name, req.body.type, TOPIC_STATE),
  // let value = req.body.value;
  const topic = `/${config.preface}/location-change`;
  const data = req.body;
  winston.info("Incoming message from Life360 Webhook: %s", data);
  state.queueHistory[topic] = data;
  client.publish(topic, data, {
    retain: true
  }, function () {
    res.send({
      status: "OK"
    });
  });
}


// main flow
async.series([
  async function init(next) {

    await refreshToken();
    next();

  },
  function configureCron(next) {
    winston.info("Configuring autosave");

    // save current state every 15 minutes
    setInterval(refreshState, 15 * 60 * 1000);

    process.nextTick(next);
  },
  function setupApp(next) {
    winston.info("Configuring API");

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
    app.post("/webhook",
      expressJoi({
        body: {
          circleId: joi.string().required(),
          placeId: joi.string().required(),
          userId: joi.string().required(),
          direction: joi.string().required(),
          timestamp: joi.string().required(),
        }
      }), handleWebhook);

    // subscribe event from SmartThings
    // app.post('/subscribe',
    //   expressJoi({
    //     body: {
    //       devices: joi.object().required(),
    //       callback: joi.string().required()
    //     }
    //   }), handleSubscribeEvent);

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
    app.use(function (err, req, res, next) {
      if (err.isBoom) {
        return res.status(err.output.statusCode).json(err.output.payload);
      }
    });

    app.listen(config.life360ReturnPort, next);
  }
], function (error) {
  if (error) {
    return winston.error(error);
  }
  winston.info("Listening at http://localhost:%s", config.life360ReturnPort);
});