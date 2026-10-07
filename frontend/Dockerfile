FROM node:22.16-alpine AS build
WORKDIR /workspace
# pnpm-lock.yaml에 고정된 버전 그대로 설치합니다. lock과 package.json이 다르면 실패합니다.
# pnpm 버전은 package.json의 packageManager 값을 Corepack이 읽어 맞춥니다.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile \
    && pnpm ls vite vitest @vitejs/plugin-react
COPY . .
RUN pnpm exec msw init public --save
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_HTTP_CLIENT=axios
ARG VITE_DATA_SOURCE=backend
ARG VITE_MOCK_SCENARIO=success
ARG VITE_DEVELOPMENT_MEMBER_ID=1
ARG VITE_ENABLE_DEVELOPMENT_MENU=true
ARG VITE_SITE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_HTTP_CLIENT=$VITE_HTTP_CLIENT
ENV VITE_DATA_SOURCE=$VITE_DATA_SOURCE
ENV VITE_MOCK_SCENARIO=$VITE_MOCK_SCENARIO
ENV VITE_DEVELOPMENT_MEMBER_ID=$VITE_DEVELOPMENT_MEMBER_ID
ENV VITE_ENABLE_DEVELOPMENT_MENU=$VITE_ENABLE_DEVELOPMENT_MENU
ENV VITE_SITE_URL=$VITE_SITE_URL
RUN pnpm run build

FROM nginx:1.28-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist /usr/share/nginx/html
EXPOSE 80
