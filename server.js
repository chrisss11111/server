import express from 'express';
import multer from 'multer';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const upload = multer({ dest: 'uploads/' });

app.post("/upload", upload.single("file"), async (req, res) => {
  const audioPath = req.file.path;

  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioPath));
    formData.append('model', 'whisper-1');

    const whisperRes = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        ...formData.getHeaders(),
      },
    });

    const userText = whisperRes.data.text;
    console.log('🎙️ User:', userText);

    const chatRes = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: userText },
        ],
      },
      {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      }
    );

    const reply = chatRes.data.choices[0].message.content;
    console.log('🤖 GPT:', reply);

    const voiceId = process.env.VOICE_ID || 'pNInz6obpgDQGcFmaJgB';
    const ttsRes = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        text: reply,
        model_id: 'eleven_monolingual_v1',
        voice_settings: { stability: 0.5, similarity_boost: 0.5 },
      },
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        responseType: 'stream',
      }
    );

    res.setHeader('Content-Type', 'audio/mpeg');
    ttsRes.data.pipe(res);

    fs.unlink(audioPath, () => {});
  } catch (err) {
    console.error('❌ Error:', err.response?.data || err.message);
    res.status(500).send("Server error");
    fs.unlink(audioPath, () => {});
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
