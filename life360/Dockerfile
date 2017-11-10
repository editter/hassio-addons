# FROM %%BASE_IMAGE%%
ARG BUILD_FROM
FROM $BUILD_FROM

FROM node:8

ENV LANG C.UTF-8

# RUN mkdir -p /
# WORKDIR /


# COPY package.json .

RUN apk add --no-cache nodejs nodejs-npm

RUN npm install --production

# COPY server.js /
# COPY . ./

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


