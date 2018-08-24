ARG BUILD_FROM=hassioaddons/base:2.1.2
FROM $BUILD_FROM

ENV CONFIG_DIR=/data
ENV IS_PROD=true
EXPOSE 8081

WORKDIR /life360
COPY rootfs /life360

RUN apk add --no-cache \
    nodejs=8.11.4-r0 \
    npm=8.11.4-r0
RUN npm install
RUN npm run build


RUN chmod a+x /life360/usr/bin/run.sh

# Run the service
CMD ["/life360/usr/bin/run.sh"]

LABEL \
    io.hass.name="Life360" \
    io.hass.description="Life 360 addon for getting location data" \
    io.hass.arch="${BUILD_ARCH}" \
    io.hass.type="addon" \
    io.hass.version=${BUILD_VERSION} \
    maintainer="Eric Ditter" \
    org.label-schema.description="Life 360 addon for getting location data" \
    org.label-schema.build-date=${BUILD_DATE} \
    org.label-schema.name="Life360" \
    org.label-schema.schema-version="1.0" \
    org.label-schema.url="https://addons.community" \
    org.label-schema.usage="https://github.com/editter/hassio-addons/tree/master/README.md" \
    org.label-schema.vcs-ref=${BUILD_REF} \
    org.label-schema.vcs-url="https://github.com/editter/hassio-addons/" \
    org.label-schema.vendor="Community Hass.io Addons"