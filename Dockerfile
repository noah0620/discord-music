FROM node:24-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends openjdk-17-jre-headless curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

RUN curl -L --fail --retry 3 \
  -o Lavalink.jar \
  https://github.com/lavalink-devs/Lavalink/releases/download/4.2.2/Lavalink.jar

RUN chmod +x /app/start.sh
EXPOSE 2333
CMD ["/app/start.sh"]
