FROM node:24-alpine

WORKDIR /usr/local/lib/node_modules/supergateway

copy ./* /usr/local/lib/node_modules/supergateway

EXPOSE 8000

run npm config set registry https://registry.npmmirror.com


run npm install -g cnpm --registry=https://registry.npmmirror.com
run cnpm install --force
env NODE_OPTIONS="--max-old-space-size=4096"

run run sh -c 'NODE_OPTIONS="--max-old-space-size=4096" npm run build'
ENTRYPOINT ["node","/usr/local/lib/node_modules/supergateway/dist/index.js"]
