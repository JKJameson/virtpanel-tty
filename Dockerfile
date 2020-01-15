FROM ubuntu:18.04
RUN apt-get update && apt install -y curl
RUN curl -sL https://deb.nodesource.com/setup_9.x | bash -
RUN apt install -y nodejs openssh-client make g++
COPY app/ /app
WORKDIR /app
RUN npm install
ENTRYPOINT /usr/bin/node app.js -p 3000