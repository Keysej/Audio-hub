import streamlit as st
from st_audiorec import st_audiorec
import datetime
import os

# Set up
st.set_page_config(page_title="Reflective Voice Journaling")
os.makedirs("recordings", exist_ok=True)

st.title("Reflective Voice Journaling")
st.subheader("🎙️ Record or upload your voice and reflect on your day.")
st.markdown("---")

# 🎤 Option 1: Record Audio
st.header("Option 1: Record Your Voice")

wav_audio_data = st_audiorec()

if wav_audio_data is not None:
    filename = f"recordings/recorded_{datetime.datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.wav"
    with open(filename, "wb") as f:
        f.write(wav_audio_data)
    st.success(f"✅ Recording saved as: {filename}")
    st.audio(wav_audio_data, format="audio/wav")

# 📁 Option 2: Upload File
st.markdown("---")
st.header("Option 2: Upload an Existing Audio File")

uploaded_file = st.file_uploader("Upload a .wav or .mp3 file", type=["wav", "mp3"])

if uploaded_file:
    filename = f"recordings/uploaded_{datetime.datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}_{uploaded_file.name}"
    with open(filename, "wb") as f:
        f.write(uploaded_file.getbuffer())
    st.success(f"✅ Uploaded and saved as: {filename}")
    st.audio(uploaded_file)
