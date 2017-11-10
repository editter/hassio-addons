ARG BUILD_FROM
FROM $BUILD_FROM

# FROM node:8

ENV LANG C.UTF-8

RUN mkdir -p /life360
WORKDIR /life360


COPY package.json /life360

RUN apk add --no-cache jq nodejs nodejs-npm \
        && npm install --production

# COPY server.js /
COPY . /life360

# Expose Configuration Volume
VOLUME /config

# Set config directory
ENV CONFIG_DIR=/config

# Exoise the web service port
EXPOSE 8081

# COPY run.sh /
# RUN chmod a+x /run.sh

# Run the service
# CMD [ "/run.sh" ]
CMD [ "npm", "start" ]


