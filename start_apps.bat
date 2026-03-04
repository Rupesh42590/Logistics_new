@echo off
set "PATH=%PATH%;C:\Program Files\nodejs;C:\Users\chbsr\AppData\Local\Programs\Python\Python311\;C:\Users\chbsr\AppData\Local\Programs\Python\Python311\Scripts\"

echo Starting backend...
start cmd /k "cd /d C:\Users\chbsr\OneDrive\Desktop\logistics\backend && python -m venv venv && .\venv\Scripts\activate && pip install -r requirements.txt && uvicorn main:app --port 8000 --reload"

echo Starting frontend...
start cmd /k "cd /d C:\Users\chbsr\OneDrive\Desktop\logistics\frontend && npm install && npm run dev"

echo Done launching servers.
