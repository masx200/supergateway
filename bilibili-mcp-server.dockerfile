FROM node:24-alpine as node_base
from crpi-dkvl22hq2vvrse0v.cn-hangzhou.personal.cr.aliyuncs.com/masx201/bilibili-mcp-server:latest

copy --from=node_base /usr/local /usr/local

WORKDIR /usr/local/lib/node_modules/supergateway
run rm -rfv /usr/local/lib/node_modules/supergateway/*
copy ./* /usr/local/lib/node_modules/supergateway
copy ./src /usr/local/lib/node_modules/supergateway/src
EXPOSE 49000 

run npm config set registry https://registry.npmmirror.com


run npm install -g cnpm --registry=https://registry.npmmirror.com
run cnpm install --force

env NODE_OPTIONS="--max-old-space-size=4096"
run sh -c 'NODE_OPTIONS="--max-old-space-size=4096" npm run build'
ENTRYPOINT ["node","/usr/local/lib/node_modules/supergateway/dist/index.js"]

run cnpm i -g @wangshunnn/bilibili-mcp-server

cmd [    "--stdio",    "npx -y \"@wangshunnn/bilibili-mcp-server\"",    "--port",    "49000",    "--outputTransport",    "streamableHttp",    "--streamableHttpPath",    "/mcp",    "--stateful"]