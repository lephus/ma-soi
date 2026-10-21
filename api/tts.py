"""Vercel function: GET /api/tts?voice=HoaiMy&text=An reads one player name with Edge TTS.

Same contract as the dev server endpoint in scripts/edge-tts.mjs.
"""

import asyncio
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

import edge_tts

VOICES = {"HoaiMy": "vi-VN-HoaiMyNeural", "NamMinh": "vi-VN-NamMinhNeural"}
MAX_NAME_LENGTH = 40


async def synthesize(voice: str, text: str) -> bytes:
    audio = bytearray()
    async for chunk in edge_tts.Communicate(text, voice).stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
    return bytes(audio)


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        voice = VOICES.get(query.get("voice", [""])[0])
        text = query.get("text", [""])[0].strip()
        if not voice or not text or len(text) > MAX_NAME_LENGTH:
            return self._reply(400, "text/plain", b"bad request")
        try:
            audio = asyncio.run(synthesize(voice, text))
        except Exception as e:  # Edge TTS unreachable or changed: the app falls back to the device voice.
            return self._reply(502, "text/plain", str(e).encode())
        self._reply(200, "audio/mpeg", audio, "public, max-age=31536000, immutable")

    def _reply(self, status: int, content_type: str, body: bytes, cache: str = "no-store"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", cache)
        self.end_headers()
        self.wfile.write(body)
