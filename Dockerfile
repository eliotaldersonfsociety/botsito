FROM node:21-alpine3.18

WORKDIR /app

COPY . .
RUN npm install --production --ignore-scripts

EXPOSE 3000

CMD ["node", "dist/app.js"]
