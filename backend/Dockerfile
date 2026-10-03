FROM python:3.14-slim

WORKDIR /usr/src/app

# Build context is the project root (see docker-compose.yml) because
# backend/fastAPI.py imports the root-level app.py/prompt.yaml/tools/.
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY app.py prompt.yaml ./
COPY tools ./tools
COPY backend ./backend

EXPOSE 8000

CMD ["uvicorn", "backend.fastAPI:app", "--host", "0.0.0.0", "--port", "8000"]
