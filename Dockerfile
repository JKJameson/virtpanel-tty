FROM node:alpine
COPY app/ /app
WORKDIR /app
RUN apk add openssh python3 make g++ && npm install --verbose && apk del python3 make g++
ENTRYPOINT nodejs app.js -p 3000
