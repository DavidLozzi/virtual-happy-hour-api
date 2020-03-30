FROM node:12.4-alpine

RUN mkdir /app
WORKDIR /app

COPY package.json package.json
RUN npm install && mv node_modules /node_modules

COPY . .

LABEL maintainer="David Lozzi"

EXPOSE 80

CMD node app.js
