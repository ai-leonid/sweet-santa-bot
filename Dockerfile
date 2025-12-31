FROM node:20-alpine AS base
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

ARG DATABASE_URL=DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

ARG TELEGRAM_BOT_TOKEN=TELEGRAM_BOT_TOKEN
ENV TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}

ARG TELEGRAM_BOT_LINK=TELEGRAM_BOT_LINK
ENV TELEGRAM_BOT_LINK=${TELEGRAM_BOT_LINK}

FROM base AS deps
RUN apk add --no-cache libc6-compat
ENV NODE_ENV=development
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
RUN npx prisma migrate dev

FROM deps AS builder
WORKDIR /app
COPY prisma ./prisma
COPY next.config.ts ./next.config.ts
COPY tsconfig.json ./tsconfig.json
COPY postcss.config.mjs ./postcss.config.mjs
COPY eslint.config.mjs ./eslint.config.mjs
COPY components.json ./components.json
COPY src ./src
COPY public ./public
RUN npx prisma generate
ENV NODE_ENV=production
RUN npm run build

FROM base AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
ENV PORT=3000
CMD ["npm", "start", "--", "-p", "3000"]
