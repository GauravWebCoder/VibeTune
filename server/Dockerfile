FROM node:20-bookworm

RUN apt-get update \
  && apt-get install -y python3 python3-pip python-is-python3 \
  && pip3 install --break-system-packages -U yt-dlp \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3001

CMD ["node", "server.js"]
