ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG C.UTF-8
RUN apk add --no-cache nodejs nodejs-npm

WORKDIR /life360

COPY package.json /life360
RUN npm install --production

# COPY server.js /

# Expose Configuration Volume
VOLUME /config
EXPOSE 8081

ENV CONFIG_DIR=/config

COPY run.sh /
RUN chmod a+x /run.sh

# Run the service
CMD [ "/run.sh" ]

# # FROM %%BASE_IMAGE%%
# ARG BUILD_FROM
# FROM $BUILD_FROM

# FROM node:8

# ENV LANG C.UTF-8

# # RUN mkdir -p /
# # WORKDIR /


# # COPY package.json .

# RUN apk add --no-cache nodejs nodejs-npm

# RUN npm install --production

# # COPY server.js /
# # COPY . ./

# # Expose Configuration Volume
# VOLUME /config

# # Set config directory
# ENV CONFIG_DIR=/config

# # Exoise the web service port
# EXPOSE 8081

# # COPY run.sh /
# # RUN chmod a+x /run.sh

# # Run the service
# # CMD [ "/run.sh" ]
# CMD [ "npm", "start" ]


