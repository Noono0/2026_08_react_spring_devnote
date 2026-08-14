@echo off
if not exist .env copy .env.example .env
docker compose up --build -d
docker compose ps
