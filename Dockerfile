FROM node:lts-alpine

RUN apk add git

ADD ./ /app

RUN cd /app \
    && npm install \
    apk del git

WORKDIR /app

ENTRYPOINT ["npm", "start"]
