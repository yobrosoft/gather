FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN groupadd --system gather && useradd --system --gid gather gather
COPY --from=build --chown=gather:gather /app/.next/standalone ./
COPY --from=build --chown=gather:gather /app/.next/static ./.next/static
USER gather
EXPOSE 8080
CMD ["sh", "-c", "HOSTNAME=0.0.0.0 node server.js"]
