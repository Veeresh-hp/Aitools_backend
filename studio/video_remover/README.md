# Video Background Remover

This tool removes the background from video files using AI.

## Setup

1.  Open a terminal in this folder.
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

## Usage

1.  Place your input video in this folder and name it **`input_video.mp4`** (or edit the script to change the filename).
2.  Run the script:
    ```bash
    python remove_video.py
    ```
3.   The script will generate **`output_video.webm`** with a transparent background.

## Notes
-   Processing is frame-by-frame and relies on `rembg` (U-2-Net model), so it might be slow for long videos.
-   The output format is `.webm` to support transparency (Alpha channel). Most standard video players might show a black background, but it will work in web browsers or video editors that support alpha channels.
