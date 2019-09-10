# Home Assistant - Life360 addon
[![Build Status](https://travis-ci.org/editter/hassio-addons.svg?branch=master)](https://travis-ci.org/editter/hassio-addons)
[![Donate](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://paypal.me/editter)
[![Patreon](https://img.shields.io/badge/Donate-Patreon-blue.svg)](https://www.patreon.com/editter)

Presence detection using the service [Life360](https://life360.com)

# DEPRECATED! - Use the native [Life360 HA Component](https://www.home-assistant.io/components/life360/)
#### This was the first thing I did when I started using [Home Assistant](https://www.home-assistant.io) and I later found out there were better ways to do it using Custom Components.  

## General

If you want Life360 to update when you enter or leave a Life360 Place open up your router's port for the addon (default is 8081).  To test if you have it open go to `{host_url}/webhook` (ex. `https://my-assistant.duckdns.org:8081/webhook`)

To view additional options see [setup.md](https://github.com/editter/hassio-addons/blob/master/life360/setup.md) file

