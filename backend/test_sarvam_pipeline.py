import asyncio
import logging
import os
import sys
from pathlib import Path

# Add backend directory to sys.path to allow imports
sys.path.append(str(Path(__file__).parent.parent))

from backend.services.sarvam_service import synthesize_speech, transcribe_audio, close
from backend.services.audio_utils import create_wav_from_mulaw, create_mulaw_from_wav

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_sarvam")

async def run_tests():
    logger.info("=== Starting Sarvam AI Isolated Test ===")
    
    test_text = "Hello! This is a test of the Sarvam AI voice pipeline running in isolation."
    
    try:
        # Step 1: Test TTS
        logger.info(f"1. Requesting TTS for text: '{test_text}'")
        tts_wav_bytes = await synthesize_speech(
            text=test_text,
            language="en-IN",
            speaker="kavya",
            model="bulbul:v3"
        )
        
        if not tts_wav_bytes:
            logger.error("TTS returned empty bytes!")
            return
        
        logger.info(f"TTS Success! Received {len(tts_wav_bytes)} bytes of WAV audio.")
        
        # Save TTS output for inspection
        with open("test_tts_original.wav", "wb") as f:
            f.write(tts_wav_bytes)
            
        # Step 2: Test WAV -> mu-law
        logger.info("2. Converting WAV to mu-law (Twilio format)...")
        mulaw_bytes = create_mulaw_from_wav(tts_wav_bytes)
        logger.info(f"WAV -> mu-law Success! Converted to {len(mulaw_bytes)} bytes of mu-law.")
        
        with open("test_tts_mulaw.raw", "wb") as f:
            f.write(mulaw_bytes)
            
        # Step 3: Test mu-law -> WAV
        logger.info("3. Converting mu-law back to WAV (Sarvam STT format)...")
        reconstructed_wav = create_wav_from_mulaw(mulaw_bytes)
        logger.info(f"mu-law -> WAV Success! Reconstructed {len(reconstructed_wav)} bytes of WAV.")
        
        with open("test_reconstructed.wav", "wb") as f:
            f.write(reconstructed_wav)
            
        # Step 4: Test STT
        logger.info("4. Requesting STT on the reconstructed audio...")
        result = await transcribe_audio(
            audio_bytes=reconstructed_wav,
            language="en-IN",
            model="saarika:v2.5"
        )
        
        transcript = result.get("transcript", "")
        logger.info(f"STT Success! Transcript received:\n\"{transcript}\"")
        
        logger.info("=== Test Completed Successfully ===")
        
    except Exception as e:
        logger.error(f"Test Failed! Exception: {e}", exc_info=True)
    finally:
        await close()

if __name__ == "__main__":
    asyncio.run(run_tests())
