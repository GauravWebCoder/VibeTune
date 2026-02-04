FROM node:18-bullseye

RUN apt-get update \
  && apt-get install -y python3 python3-pip \
  && pip3 install -U yt-dlp \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3001

CMD ["node", "server.js"]
