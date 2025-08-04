FROM node:24-alpine

RUN npm install -g supergateway

EXPOSE 8000

ENTRYPOINT ["supergateway"]

CMD ["--help"]
