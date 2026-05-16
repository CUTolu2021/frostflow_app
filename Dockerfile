# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# ---------------------------------------------
# 1. Define the Arguments (Placeholders)
# ---------------------------------------------
ARG SUPABASE_URL
ARG SUPABASE_KEY
ARG N8N_WEBHOOK_URL
ARG API_URL

# ---------------------------------------------
# 2. Create the file using the Arguments
# ---------------------------------------------
# We use 'print' to write the file dynamically based on what Coolify sends us
RUN mkdir -p src/environments

RUN printf "export const environment = {\n\
  production: true,\n\
  supabase_URL: '%s',\n\
  supabase_anon_key: '%s',\n\
  n8n_webhook: '%s',\n\
  api_url: '%s'\n\
};\n" "$SUPABASE_URL" "$SUPABASE_KEY" "$N8N_WEBHOOK_URL" "$API_URL" > src/environments/environment.ts

# Copy to prod just in case
RUN cp src/environments/environment.ts src/environments/environment.prod.ts

# Build
RUN npm run build -- --configuration production

# Stage 2: Serve
FROM nginx:alpine
COPY --from=build /app/dist/frostflow_app/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
