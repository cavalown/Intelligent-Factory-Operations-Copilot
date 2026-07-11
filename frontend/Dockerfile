# MVP: Vite dev server (hot reload, matches local workflow). A production
# build stage is a later concern — see add-frontend-mvp design D8.
# node:22-slim matches the backend's base image.
FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
