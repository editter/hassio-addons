
## Config Parameters

| Param              | Description                                                                                                                           |
|--------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| process_type       | Used to determine how the data is pushed to home assistant.  Options are [MQTT](https://home-assistant.io/components/device_tracker.mqtt_json/) or HTTP
| mqtt_host          | **(only used when process_type=MQTT)** MQTT broker host. Defaults to `mqtt://<mqtt_host>` but if you want to use another protocol use the full URL ex. `ws://examplehost.com` |
| mqtt_port          | **(only used when process_type=MQTT)** MQTT broker port                                                                                                                      |
| mqtt_username      | **(only used when process_type=MQTT)** MQTT broker login                                                                                                                     |
| mqtt_password      | **(only used when process_type=MQTT)** MQTT broker password                                                                                                                  |
| preface            | **(only used when process_type=MQTT)** Preface for MQTT topic                                                                                                                     |
| cert_file          | SSL cert file                                                                                                                         |
| key_file           | SSL key file                                                                                                                          |
| host_url           | Your public hostname used by Life360 location triggers. Example: `https://my-assistant.duckdns.org:8081`                               |
| life360_user       | Life360 username                                                                                                                      |
| life360_password   | Life360 password                                                                                                                      |
| refresh_minutes    | How often the addon will update the data |
| user_device_map.life360_name   |  **(only used when process_type=HTTP)** the life360 first name|
| user_device_map.known_devices_name   |  **(only used when process_type=HTTP)** the dev_id in known_devices.yaml you want to update|

## Config Examles

### known_devices.yaml

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

#### configuration.yaml - MQTT

```yaml
device_tracker:
  - platform: mqtt_json
    devices:
      #          {preface}/location/{life360 first name}
      eric_phone: life360/location/Eric
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

#### configuration.yaml - HTTP

```yaml
device_tracker:
```

## Message Bodies

### MQTT

``` json
{
  "longitude": -67.89,
  "latitude": 12.345,
  "gps_accuracy": 50,
  "battery_level": 74,
  "is_intransit": 0,
  "is_charging": 0,
  "name": "Eric",
  "speed": -1,
  "is_driving": 0,
  "is_intransit": 0,
  "is_charging": 1,
  "wifi_state": 1,
  "address1": "123 Sesame St",
  "address2":""
}
```

### HTTP

``` json
{
  "dev_id": "eric_phone",
  "gps": [12.345, -67.89],
  "gps_accuracy": 50,
  "battery": 74,
  "name": "Eric",
  "attributes": {
    "speed": -1,
    "is_driving": 0,
    "is_intransit": 0,
    "is_charging": 1,
    "wifi_state": 1,
    "address1": "123 Sesame St",
    "address2":""
  }
}
```