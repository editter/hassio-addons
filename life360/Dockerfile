FROM node:8

ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG C.UTF-8
RUN apk add --no-cache nodejs nodejs-npm

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app


COPY package.json /usr/src/app/
RUN npm install --production

# COPY server.js /
COPY . /usr/src/app

# Expose Configuration Volume
VOLUME /config

# Set config directory
ENV CONFIG_DIR=/config

# Exoise the web service port
EXPOSE 8081

COPY run.sh /
RUN chmod a+x /run.sh

# Run the service
CMD [ "/run.sh" ]

