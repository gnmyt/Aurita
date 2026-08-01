FROM node:22-bookworm AS web
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
ARG VITE_BASE=/tv/
RUN VITE_BASE=${VITE_BASE} npm run build && mv dist /server-dist

FROM nginx:alpine
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 nginx/10-aurita-config.sh /docker-entrypoint.d/10-aurita-config.sh
COPY --from=web /server-dist /usr/share/nginx/html/tv
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/tv/ >/dev/null 2>&1 || exit 1
