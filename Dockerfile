# pin the python minor: nightly rebuilds must not silently jump to a new
# python release and break wheel availability on alpine. alpine itself floats
# on purpose: ffmpeg and deno come from its community repo, which only gets
# fixes until the next alpine release (~6 months), so the weekly uncached
# rebuild has to move to the new release to keep them patched.
FROM python:3.14-alpine

# Alpine's ffmpeg is musl-native, apk-maintained, and small (no Debian GUI tree).
# Provides both ffmpeg and ffprobe, used by yt-dlp's FFmpeg postprocessors.
# deno is the JS runtime yt-dlp needs to solve youtube's player challenges
# (with yt-dlp-ejs); without it youtube serves few or no formats.
RUN apk add --no-cache ffmpeg deno

# Pin build tooling so renewing the lockfile produces deterministic transitive deps.
RUN pip install --no-cache-dir pip==26.1.2 setuptools==83.0.0 wheel==0.47.0

# Create non-root user and prepare downloads dir with correct ownership
RUN adduser -D -u 1000 app && mkdir -p /app/downloads && chown app:app /app/downloads

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=app:app . .

ENV HOST=0.0.0.0

LABEL org.opencontainers.image.source=https://github.com/toastbrot2000/very-simple-yt-downloader

USER app

EXPOSE 8000

CMD ["python", "main.py"]
