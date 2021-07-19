FROM node:14.16-alpine

ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH=$PATH:/home/node/.npm-global/bin

RUN mkdir -p /home/node/app/node_modules \
      /home/node/federation-subscription-tools/node_modules && \
    chown -R node:node /home/node/app && \
    chown -R node:node /home/node/federation-subscription-tools

USER node

COPY --chown=node:node ../../ /home/node/federation-subscription-tools
COPY --chown=node:node . /home/node/app

WORKDIR /home/node/federation-subscription-tools

RUN npm install -g graphql && npm install --no-optional && \
    npm cache clean --force && npm link && npm link graphql

WORKDIR /home/node/app

RUN npm install --no-optional && npm cache clean --force && \
    npm link federation-subscription-tools && npm link graphql
