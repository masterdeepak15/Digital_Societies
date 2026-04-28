@echo off
setlocal
set ROOT=D:\Claude\Society-App\society-app-spec

echo.
echo === Stopping all containers and wiping DB volume ===
cd /d %ROOT%\infra\docker
docker compose down -v
echo.

echo === Starting infrastructure (postgres, redis, minio) ===
docker compose up -d postgres redis minio
echo Waiting 15s for postgres to be ready...
ping -n 16 127.0.0.1 > nul

echo.
echo === Building and starting API ===
docker compose build api
docker compose up -d api
echo Waiting 45s for migrations to run...
ping -n 46 127.0.0.1 > nul

echo.
echo === Starting web-admin ===
docker compose up -d web-admin

echo.
echo === API startup logs (last 80 lines) ===
docker compose logs --tail=80 api

echo.
echo === Container status ===
docker compose ps

echo.
echo === DONE ===
