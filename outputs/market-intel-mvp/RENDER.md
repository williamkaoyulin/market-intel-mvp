# Render Deployment

This app is a single Python web service. It serves the frontend and API from the same origin.

## Render settings

- Runtime: Python
- Build command: `pip install -r requirements.txt`
- Start command: `python live_server.py`
- Health check path: `/`

## Files Render needs

- `live_server.py`
- `index.html`
- `app.js`
- `styles.css`
- `requirements.txt`
- `render.yaml`
