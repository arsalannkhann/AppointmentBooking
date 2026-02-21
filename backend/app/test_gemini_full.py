import os
import google.generativeai as genai

genai.configure(api_key=os.environ.get("GOOGLE_API_KEY", ""))

from app.routers.chat import build_system_prompt

model = genai.GenerativeModel(
    model_name="gemini-3-flash-preview",
    system_instruction=build_system_prompt([])
)

try:
    response = model.generate_content([
        {"role": "user", "parts": ["Hi, I have severe pain in my upper right tooth, especially at night and with hot or cold drinks. I also have an impacted wisdom tooth that swells sometimes."]},
        {"role": "model", "parts": ["I’m sorry to hear you’re dealing with such significant pain and swelling; that sounds very uncomfortable. Based on your symptoms, it sounds like we should schedule a **Root Canal Consultation** for the upper tooth and a **Wisdom Tooth Consultation** to assess the impacted tooth. To help me find the best options for you, could you please provide: 1. Your **full name**? 2. Which clinic location you prefer: **Downtown** or **Westside**? 3. Any particular **day or time** next week that works best for you?"]},
        {"role": "user", "parts": ["Arsalan Khan, Westside , earliest"]},
    ], generation_config=genai.types.GenerationConfig(max_output_tokens=1024))
    print(f"Text length: {len(response.text)}")
    print(f"Text: {response.text}")
    print(f"Finish Reason: {response.candidates[0].finish_reason}")
except Exception as e:
    print(f"Error: {e}")
