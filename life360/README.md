# Home Assistant - Life360

Presence detection using the service [Life360](https://life360.com)

## General

If you want Life360 to update when you enter or leave a Life360 Place open up your router's port for the addon (default is 8081).  To test if you have it open go to `{host_url}/webhook`

## Config Parameters

| Param              | Description                                                                                                                           |
|--------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| process_type       | Options are MQTT or HTTP
| mqtt_host          | MQTT broker host. Defaults to `mqtt://<mqtt_host>` but if you want to use another protocol use the full URL ex. `ws://examplehost.com` |
| mqtt_port          | MQTT broker port                                                                                                                      |
| mqtt_username      | MQTT broker login                                                                                                                     |
| mqtt_password      | MQTT broker password                                                                                                                  |
| preface            | Preface for MQTT topic                                                                                                                     |
| cert_file          | SSL cert file                                                                                                                         |
| key_file           | SSL key file                                                                                                                          |
| host_url           | Your public hostname used by Life360 location triggers Example: `https://my-assistant.duckdns.org:8081`                               |
| life360_user       | Life360 username                                                                                                                      |
| life360_password   | Life360 password                                                                                                                      |
| refresh_minutes    | How often the addon will update the data |
| user_device_map.life360_name   |  the life360 first name|
| user_device_map.known_devices_name   |  the dev_id in known_devices.yaml you want to update|

## Config Examles

#### known_devices.yaml

```yaml
eric_phone:
  track: yes
  hide_if_away: no
  name: Eric Location
```

### Life360 addon options - MQTT

```json
{
    "process_type": "MQTT",
    "mqtt_host": "127.0.0.1",
    "mqtt_port": 1883,
    "mqtt_username": "MyUser",
    "mqtt_password": "MyPassword",
    "preface": "life360",
    "cert_file": "fullchain.pem",
    "key_file": "privkey.pem",
    "host_url": "https://mySite.com:8081",
    "refresh_minutes": 5,
    "user_device_map": [],
    "life360_user": "MyLife360User",
    "life360_password": "MyLife360Password"
  }
```

#### configuration.yaml

```yaml
device_tracker:
  - platform: mqtt_json
    devices:
      #        {preface}/location/{life360 first name}
      my_phone: life360/location/Eric
```

### Life360 addon options - HTTP

```json
{
    "process_type": "HTTP",
    "mqtt_host": "",
    "mqtt_port": 0,
    "mqtt_username": "",
    "mqtt_password": "",
    "preface": "",
    "cert_file": "fullchain.pem",
    "key_file": "privkey.pem",
    "host_url": "https://mySite.com:8081",
    "refresh_minutes": 5,
    "user_device_map": [{
      "life360_name": "Eric",
      "known_devices_name": "eric_phone"
    }],
    "life360_user": "MyLife360User",
    "life360_password": "MyLife360Password"
  }
```

## Releases

### 0.0.6

- Added the option to use HTTP location tracking instead of forcing MQTT

### 0.0.5

- Added refresh_minutes setting for quicker refresh rates
- Removed file logging (not sure if they are viewable in Hass.io)
- Minor bug fixes

### 0.0.4

- Made preface the start of the MQTT topic and removed the slash in code
- Added some minor security to the webhook
- Removed the web interface due to it not being secure (may add it back in when I figure out how to make it secure)