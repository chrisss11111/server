const express = require("express");
const multer = require("multer");
const fs = require("fs");
const axios = require("axios");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Upload setup
const upload = multer({ dest: "uploads/" });

app.post("/upload", upload.single("audio"), async (req, res) => {
  const audioPath = req.file.path;

  try {
    // 1. Send to Whisper (OpenAI STT)
    const whisperResp = await axios.post("https://api.openai.com/v1/audio/transcriptions", 
      fs.createReadStream(audioPath), {
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "audio/wav"
        },
        params: {
          model: "whisper-1"
        }
      });

    const text = whisperResp.data.text;
    console.log("STT:", text);
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';

const app = express();
const upload = multer({ dest: 'uploads/' });

const OPENAI_API_KEY = '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'; // 
const ELEVENLABS_API_KEY = 'sk_395493579726778a10d5f99773a5f40ddae1fcc9af309b1b'; // Put your ElevenLabs key here

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const audioPath = req.file.path;

    // Step 1: Whisper STT
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioPath));
    formData.append('model', 'whisper-1');
    const whisperRes = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        ...formData.getHeaders()
      }
    });
    const userText = whisperRes.data.text;
    console.log('User said:', userText);

    // Step 2: ChatGPT Response
    const chatRes = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: userText }
      ]
    }, {
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }
    });
    const reply = chatRes.data.choices[0].message.content;
    console.log('GPT replied:', reply);

    // Step 3: Text-to-Speech (ElevenLabs)
    const ttsRes = await axios.post(
      'https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB/stream', // use your voice ID here
      {
        text: reply,
        model_id: 'eleven_monolingual_v1',
        voice_settings: { stability: 0.5, similarity_boost: 0.5 }
      },
      {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        },
        responseType: 'stream'
      }
    );

    // Step 4: Pipe the audio stream as response
    res.setHeader('Content-Type', 'audio/mpeg');
    ttsRes.data.pipe(res);

    // Cleanup temp file
    fs.unlink(audioPath, () => {});
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
