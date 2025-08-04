FROM docker.cnb.cool/masx200/docker_mirror/node:24-alpine-linux-amd64 as node_base
from registry.cn-hangzhou.aliyuncs.com/masx200/mcp-math-eval:latest

copy --from=node_base /usr/local /usr/local

WORKDIR /usr/local/lib/node_modules/supergateway
run rm -rfv /usr/local/lib/node_modules/supergateway/*
copy ./* /usr/local/lib/node_modules/supergateway
copy ./src /usr/local/lib/node_modules/supergateway/src
EXPOSE 49001  

run npm config set registry https://registry.npmmirror.com


run npm install -g cnpm --registry=https://registry.npmmirror.com
run cnpm install --force

env NODE_OPTIONS="--max-old-space-size=4096"
run sh -c 'NODE_OPTIONS="--max-old-space-size=4096" npm run build'
ENTRYPOINT ["node","/usr/local/lib/node_modules/supergateway/dist/index.js"]

run cnpm i -g @mcpcn/mcp-math-eval

cmd [    "--stdio",    "npx -y \"@mcpcn/mcp-math-eval\"",    "--port",    "49001",    "--outputTransport",    "streamableHttp",    "--streamableHttpPath",    "/mcp",    "--stateful"]