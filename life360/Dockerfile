ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG C.UTF-8
ENV CONFIG_DIR=/data
ENV IS_PROD=true
EXPOSE 8081

RUN apk add --no-cache nodejs nodejs-npm

WORKDIR /life360


COPY server.ts life360.d.ts tsconfig.json package.json /life360/
RUN npm install
RUN npm run build
# COPY server.js /life360
COPY run.sh /


RUN chmod a+x /run.sh

# Run the service
CMD [ "/run.sh" ]
