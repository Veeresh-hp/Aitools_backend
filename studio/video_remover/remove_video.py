import os
from rembg import remove
from moviepy.editor import VideoFileClip

import numpy as np
from PIL import Image

def remove_video_background(input_path, output_path):
    # Check if input file exists
    if not os.path.exists(input_path):
        print(f"Error: Input file '{input_path}' not found.")
        return

    print(f"Processing video: {input_path}")
    
    # Load the video
    try:
        clip = VideoFileClip(input_path)
    except Exception as e:
        print(f"Error loading video: {e}")
        return

    # function to process each frame
    def process_frame(frame):
        # frame is a numpy array (Height, Width, 3)
        # rembg expects a PIL Image or bytes, but newer versions can take numpy
        # For safety and compatibility, convert to PIL Image
        pil_image = Image.fromarray(frame)
        
        # Remove background
        result_image = remove(pil_image)
        
        # Convert back to numpy array
        # The result will be RGBA, so we preserve the alpha channel
        return np.array(result_image)

    # Apply the effect to the video
    # We need to ensure the output has an alpha channel (mask) if we want transparency
    # moviepy's fl_image works on frames. 
    # Validating if we want a transparent background video export (e.g. .mov with prores or .webm)
    # usually .mp4 doesn't support transparency well in all players, but we will try extracting it.
    # For general compatibility, maybe green screen? 
    # But 'remove background' usually implies transparency.
    # We will export as .webm which supports transparency for web, or .gif, or .mov
    
    # Let's try to export as .webm (VP9) which supports alpha
    # If the user wants .mp4, it will have black background where removed usually unless composed.
    
    processed_clip = clip.fl_image(process_frame)
    
    print("Starting rendering... this might take a while depending on video length.")
    
    # Output file extension check
    _, ext = os.path.splitext(output_path)
    codec = 'libx264'
    if ext.lower() == '.webm':
        codec = 'libvpx'
    elif ext.lower() == '.mov':
        codec = 'prores_ks' # supports alpha
    elif ext.lower() == '.gif':
        processed_clip.write_gif(output_path)
        return

    # If we want transparency in video, we need to set write_videofile params correctly
    if codec in ['libvpx', 'prores_ks']:
         processed_clip.write_videofile(output_path, codec=codec, audio_codec='libvorbis')
    else:
        # Default fallback for mp4 (no transparency usually supported in standard players, background becomes black)
        # We can compose it dynamically over a color if needed, but raw removal is requested.
        processed_clip.write_videofile(output_path, codec='libx264', audio_codec='aac')

    print(f"Done! Saved to {output_path}")

if __name__ == "__main__":
    # Example usage
    # You can change these filenames or use input()
    input_video = "input_video.mp4" 
    output_video = "output_video.webm" # .webm or .mov for transparency
    
    # Simple check to see if user put a file there
    if not os.path.exists(input_video):
        print(f"Please place a video file named '{input_video}' in this folder or update the script.")
    else:
        remove_video_background(input_video, output_video)
