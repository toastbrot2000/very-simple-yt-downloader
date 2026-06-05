# Contributing to yt-dlp Web GUI

First off, thanks for taking the time to contribute! Contributions are what make the open-source community such an amazing place to learn, inspire, and create.

## How Can I Contribute?

### Reporting Bugs
- Check the [Issues](https://github.com/your-username/yt-dlp-web-gui/issues) to see if the bug has already been reported.
- If not, open a new issue. Clearly describe the problem and include steps to reproduce it.

### Suggesting Enhancements
- Open an issue with the "enhancement" tag.
- Describe the feature you'd like to see and why it would be useful.

### Pull Requests
1. Fork the repository.
2. Create a new branch (`git checkout -b feature/your-feature`).
3. Make your changes.
4. Run linting:
   - Python: `flake8 .`
   - JS: `npm run lint`
5. Commit your changes (`git commit -m 'Add some feature'`).
6. Push to the branch (`git push origin feature/your-feature`).
7. Open a Pull Request.

## Coding Standards
- Follow PEP 8 for Python code.
- Use meaningful variable and function names.
- Keep functions small and focused.
- Document complex logic with comments.

## Development Environment
Ensure you have `ffmpeg` installed on your system as it is required for media processing.

1. Clone your fork.
2. Create a virtual environment: `python -m venv .venv`
3. Activate it and install dependencies: `pip install -r requirements.txt`
4. Run the development server: `python main.py`

Thank you for contributing!
