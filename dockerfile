# Template from https://github.com/nodeshift/docker

# Install the app dependencies
FROM node:14 as BUILDER

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install --production

# Copy the dependencies into a Slim Node docker image
FROM node:14-slim

# Install app dependencies
COPY --from=BUILDER ./node_modules /opt/app/node_modules
COPY . /opt/app

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD "bash -c 'echo \"HEAD / HTTP/1.0\" >/dev/tcp/localhost/80'"

WORKDIR "/opt/app"

ENTRYPOINT ["node", "index.js"]