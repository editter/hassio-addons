# Home Assistant - Life360

Presence detection using the service [Life360](https://life360.com)

## FYI

- Life360 doesn't provide any documentation on their API so I followed their SmartThings plugin to try to fit their standards.  They clear out all existing webhooks in their code so I did the same.  This means if you have any other applications being triggered from Life360 directly they will be removed (or at least I assume).  If you don't want that to use webhooks here then don't configure host_url

- This plugin forces you to have https so the cert and key files are required.  Home assistant makes it very easy to do so this shouldn't be a problem.

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

## configuration.yaml

```yaml
device_tracker:
  - platform: mqtt_json
    devices:
      my_phone: {preface}/location/{life360 first name}
```

### Releases

#### 0.0.3

- Made preface the start of the MQTT topic and removed the slash in code
- Added some minor security to the webhook
- Removed the web interface due to it not being secure (may add it back in when I figure out how to make it secure)