#!/bin/bash
# Starts the API once the database and file store are accepting connections.
set -e
until pg_isready -q -h 127.0.0.1 -p 5432 -U ds_app; do sleep 1; done
until curl -fsS -o /dev/null http://127.0.0.1:9000/minio/health/live; do sleep 1; done
cd /app/api
exec dotnet DigitalSocieties.Api.dll
