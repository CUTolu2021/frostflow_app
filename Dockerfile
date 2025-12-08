# ----------------------------
# Stage 1: Build the Angular App
# ----------------------------
FROM node:18-alpine as build

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the code
COPY . .

# Build for production (Output goes to /app/dist/your-project-name)
RUN npm run build -- --configuration production

# ----------------------------
# Stage 2: Serve with Nginx
# ----------------------------
FROM nginx:alpine

# Copy the build output from Stage 1 to the Nginx html folder
# REPLACE 'frost-flow' below with your actual project name from angular.json
COPY --from=build /app/dist/frost-flow_app/browser /usr/share/nginx/html

# Copy our custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]