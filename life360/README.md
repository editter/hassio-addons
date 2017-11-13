# Home Assistant - Life360

Presence detection using the service [Life360](https://life360.com)

| Param              | Description                                             |
|--------------------|---------------------------------------------------------|
| mqttHost           | MQTT broker host                                        |
| mqttPort           | MQQT broker port                                        |
| preface            | Preface for topics                                      |
| mqttUsername       | MQTT broker login                                       |
| mqttPassword       | MQTT broker passwor                                     |
| ssl                | Are you using SSL?                                      |
| certFile           | SSL cert file                                           |
| keyFile            | SSL key file                                            |
| life360ReturnHost  | Your public hostname used by Life360 location triggers  |
| life360User        | Life360 username                                        |
| life360Password    | Life360 password                                        |

## configuration.yaml

```yaml
device_tracker:
  - platform: mqtt_json
    devices:
      my_phone: life360/location/[life360 first name]
```