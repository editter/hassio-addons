# Home Assistant - Life360

Presence detection using the service [Life360](https://life360.com)

## Config Parameters

| Param              | Description                                                                                                                           |
|--------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| mqtt_host          | MQTT broker host. Defaults to `mqtt://<mqtt_host>` but if you want to use another protocol use the full URL ex. `ws://examplehost.com` |
| mqtt_port          | MQTT broker port                                                                                                                      |
| mqtt_username      | MQTT broker login                                                                                                                     |
| mqtt_password      | MQTT broker password                                                                                                                  |
| preface            | Preface for topic                                                                                                                     |
| cert_file          | SSL cert file                                                                                                                         |
| key_file           | SSL key file                                                                                                                          |
| host_url           | Your public hostname used by Life360 location triggers Example: `https://my-assistant.duckdns.org:8081`                               |
| life360_user       | Life360 username                                                                                                                      |
| life360_password   | Life360 password                                                                                                                      |
| refresh_minutes    | How often the addon will update the data                                                                                               |

## configuration.yaml

```yaml
device_tracker:
  - platform: mqtt_json
    devices:
      my_phone: {preface}/location/{life360 first name}
```

If you want Life360 to update when you enter or leave a Life360 Place open up your router's port for the addon (default is 8081).  To test if you have it open go to `{host_url}/webhook`

## Releases

### 0.0.5

- Added refresh_minutes setting for quicker refresh rates
- Removed file logging (not sure if they are viewable in Hass.io)
- Minor bug fixes

### 0.0.4

- Made preface the start of the MQTT topic and removed the slash in code
- Added some minor security to the webhook
- Removed the web interface due to it not being secure (may add it back in when I figure out how to make it secure)