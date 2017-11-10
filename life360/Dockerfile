ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG C.UTF-8
RUN apk add --no-cache nodejs nodejs-npm

WORKDIR /life360

COPY package.json /
RUN npm install --production

# COPY server.js /

# Expose Configuration Volume
VOLUME /config
EXPOSE 8081

ENV CONFIG_DIR=/daconfigta

COPY run.sh /
RUN chmod a+x /run.sh

# Run the service
CMD [ "/run.sh" ]

