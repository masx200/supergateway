FROM node:24-alpine as node_base
from registry.cn-hangzhou.aliyuncs.com/masx200/mcp-qrcode:2025-08-03-12-36-24

copy --from=node_base /usr/local /usr/local

WORKDIR /usr/local/lib/node_modules/supergateway

copy ./* /usr/local/lib/node_modules/supergateway

EXPOSE 8000

run npm config set registry https://registry.npmmirror.com


run npm install -g cnpm --registry=https://registry.npmmirror.com
run cnpm install --force

env NODE_OPTIONS="--max-old-space-size=4096"
run sh -c 'NODE_OPTIONS="--max-old-space-size=4096" npm run build'
ENTRYPOINT ["node","/usr/local/lib/node_modules/supergateway/dist/index.js"]

run cnpm i -g @mcpcn/mcp-qrcode

cmd ['--stdio', 'npx -y "@mcpcn/mcp-qrcode"' ,'--port' ,'8000', '--outputTransport', 'streamableHttp', '--streamableHttpPath', '/mcp' ,'--stateful']