FROM node:22.16-alpine AS build
WORKDIR /workspace
COPY package.json .npmrc ./
RUN npm install --no-audit --no-fund --include=dev \
    && npm ls vite vitest @vitejs/plugin-react
COPY . .
RUN npx --no-install msw init public --save
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_HTTP_CLIENT=axios
ARG VITE_DATA_SOURCE=backend
ARG VITE_MOCK_SCENARIO=success
ARG VITE_DEVELOPMENT_MEMBER_ID=1
ARG VITE_ENABLE_DEVELOPMENT_MENU=true
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_HTTP_CLIENT=$VITE_HTTP_CLIENT
ENV VITE_DATA_SOURCE=$VITE_DATA_SOURCE
ENV VITE_MOCK_SCENARIO=$VITE_MOCK_SCENARIO
ENV VITE_DEVELOPMENT_MEMBER_ID=$VITE_DEVELOPMENT_MEMBER_ID
ENV VITE_ENABLE_DEVELOPMENT_MENU=$VITE_ENABLE_DEVELOPMENT_MENU
RUN npm run build

FROM nginx:1.28-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist /usr/share/nginx/html
EXPOSE 80
