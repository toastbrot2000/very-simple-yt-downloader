# yt-dlp Web GUI

A simple web interface for [yt-dlp](https://github.com/yt-dlp/yt-dlp) to download videos and audio from YouTube and other supported sites.

## Prerequisites

- Python 3.7+
- [FFmpeg](https://ffmpeg.org/) (required/recommended for audio extraction and format merging)

## Installation

1. Clone or download this repository.
2. Install the required Python packages:

```bash
pip install -r requirements.txt
```

## Usage

Start the server by running:

```bash
python main.py
```

Or using uvicorn directly:

```bash
uvicorn main:app --reload
```

Once running, open your browser and navigate to:

[http://localhost:8000](http://localhost:8000)

## Features

- Download video (MP4) or audio (MP3)
- Real-time download progress
- Simple and clean interface
