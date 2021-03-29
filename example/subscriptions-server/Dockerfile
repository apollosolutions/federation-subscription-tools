FROM node:14.16-alpine

ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH=$PATH:/home/node/.npm-global/bin

RUN mkdir -p /home/node/app/node_modules \
      /home/node/federation-subscription-tools/node_modules && \
    chown -R node:node /home/node/app && \
    chown -R node:node /home/node/federation-subscription-tools

USER node

WORKDIR /home/node/federation-subscription-tools

COPY package*.json ./

RUN npm install -g graphql && npm install --no-optional && \
    npm cache clean --force && npm link && npm link graphql

COPY --chown=node:node . .

WORKDIR /home/node/app

COPY example/subscriptions-server/package*.json ./

RUN npm install --no-optional && npm cache clean --force && \
    npm link federation-subscription-tools && npm link graphql

COPY --chown=node:node example/subscriptions-server .
