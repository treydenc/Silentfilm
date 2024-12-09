// pages/api/convert-to-mp4.js
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import formidable from 'formidable';

const execAsync = promisify(exec);

// Disable body parsing, we'll handle the form data manually
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse form data
    const form = new formidable.IncomingForm();
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    const inputFile = files.video;
    const inputPath = inputFile.filepath;
    const outputPath = path.join(process.cwd(), 'tmp', `${Date.now()}.mp4`);

    // Ensure tmp directory exists
    await fs.mkdir(path.join(process.cwd(), 'tmp'), { recursive: true });

    // Convert WebM to MP4 using FFmpeg
    await execAsync(`ffmpeg -i "${inputPath}" -c:v libx264 -preset fast -crf 22 -c:a aac -b:a 128k "${outputPath}"`);

    // Read the converted file
    const mp4Data = await fs.readFile(outputPath);

    // Clean up temporary files
    await Promise.all([
      fs.unlink(inputPath),
      fs.unlink(outputPath)
    ]);

    // Send the MP4 file
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'attachment; filename="animation.mp4"');
    res.send(mp4Data);

  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ error: 'Conversion failed' });
  }
}