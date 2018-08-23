## Releases

### 0.0.13

- Allowed refresh seconds to be a float instead of an int
- Updated base image to fix API bugs

### 0.0.12

- Added hassio api key

### 0.0.11

- Removed the server if there isn't a webhook

### 0.0.10

- Removed the requirement for SSL certificates.  Not webhook is setup in that case
- Separated readme.md into two files so it isn't so ugly in hassio web page

### 0.0.9

- Moved attributes for HTTP so they are accessible in sensor

### 0.0.8

- Added is_charging option per user request
- Removed address from MQTT message

### 0.0.7

- Checked user location data to ensure it exists (in some cases it doesn't seem to get populated)
- Added initial information on startup to help with debugging

### 0.0.6

- Added the option to use HTTP for reporting the location instead of forcing MQTT. If you want to continue using MQTT there is no change required for you, just providing options for people.

### 0.0.5

- Added refresh_minutes setting for quicker refresh rates
- Removed file logging (not sure if they are viewable in Hass.io)
- Minor bug fixes

### 0.0.4

- Made preface the start of the MQTT topic and removed the slash in code
- Added some minor security to the webhook
- Removed the web interface due to it not being secure (may add it back in when I figure out how to make it secure)
