# منصة سهم سكرينر — صورة إنتاج للخادم الخاص
# البناء: docker compose build   التشغيل: docker compose up -d

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund && npx prisma generate

# مرحلة الترحيل: تملك node_modules كاملة — تشغّل db push مرة واحدة ثم تنتهي
# (compose يشغّلها قبل التطبيق عبر depends_on: service_completed_successfully)
FROM deps AS migrate
CMD ["npx", "prisma", "db", "push", "--skip-generate"]

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# مخرجات Next المستقلة + الأصول
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# عميل Prisma المولّد ومحركاته — قد لا يشمله تتبع standalone كاملاً
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3000
CMD ["node", "server.js"]
