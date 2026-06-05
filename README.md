# ForpConv

ForpConv is a web tool that runs entirely in your browser to trim and convert audio or video files into iPhone ringtones (.m4r).

<img width="1077" height="604" alt="Bildschirmfoto 2026-06-04 um 21 20 27" src="https://github.com/user-attachments/assets/6be23c7d-3716-4384-b8fc-f2f937ed059f" />

## How it Works in Your Browser

- **Zero Installs**: You do not need to download or install any applications on your computer. Simply open the web page and start converting.
- **Complete Privacy**: All file processing is done locally on your machine using WebAssembly. Your files are never uploaded to a server, keeping your audio and video fully private.
- **Offline Capable**: Once the page is loaded, it can run entirely offline without an active internet connection.
- **Real-Time Previews**: Listen to your trimmed selection, fade effects, and volume boosts in real time directly inside the browser timeline.

## Quick Start

1. Open the website.
2. Drag and drop any audio or video file (like MP3, M4A, or MP4) into the upload box.
3. Trim the segment to your preferred length (up to 30 seconds).
4. Customize the volume boost and fade-in or fade-out duration.
5. Click **Create M4R Ringtone** and save the file to your computer.

## Running Locally (for Developers)

If you want to run the project code locally on your machine:

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the local development server:

   ```bash
   npm run dev
   ```

3. Open the address shown in your terminal (usually `http://localhost:5173`).
