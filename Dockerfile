# =========================================================
# AquaFit Upsell Bot - Dockerfile (Railway fix Chromium)
# =========================================================
FROM node:18-bullseye

# Instala dependências necessárias pro Chromium
RUN apt-get update && apt-get install -y \
    wget gnupg ca-certificates \
    libnss3 libxss1 libasound2 libatk1.0-0 \
    libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxrandr2 \
    libgbm1 libpango-1.0-0 libxdamage1 \
    libgtk-3-0 libxshmfence1 libx11-xcb1 \
    fonts-liberation libappindicator3-1 xdg-utils \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Cria diretório da aplicação
WORKDIR /app

# Copia dependências e instala
COPY package*.json ./
RUN npm install --production

# Copia todo o resto do código
COPY . .

# Define a porta (Railway usa 8080)
EXPOSE 8080

# Inicia o servidor
CMD ["npm", "start"]
