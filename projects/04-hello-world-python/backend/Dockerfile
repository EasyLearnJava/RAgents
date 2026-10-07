# Container for Cloud Run. Google's Cloud Build builds this in the cloud (`gcloud run deploy --source .`),
# so Docker isn't needed on your machine.
FROM python:3.13-slim

# Don't write .pyc files; print logs straight away (Cloud Run collects stdout).
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY agent.py main.py ./

# Run as a non-root user.
RUN useradd --create-home appuser
USER appuser

# Cloud Run tells the app which port to listen on through $PORT (8080 by default).
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}
