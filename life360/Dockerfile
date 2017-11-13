ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG C.UTF-8
RUN apk add --no-cache nodejs-current nodejs-npm

WORKDIR /life360

COPY package.json /life360
COPY server.js /life360
RUN npm install --production

# Expose Configuration Volume
# VOLUME /data
EXPOSE 8081

ENV CONFIG_DIR=/data
ENV IS_PROD=true

COPY run.sh /
RUN chmod a+x /run.sh

# Run the service
CMD [ "/run.sh" ]
