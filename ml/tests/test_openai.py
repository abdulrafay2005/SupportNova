import os

from dotenv import load_dotenv
from openai import OpenAI


load_dotenv()


api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    raise ValueError("OPENAI_API_KEY was not found in .env")


client = OpenAI(
    api_key=api_key
)


response = client.responses.create(
    model="gpt-5.6-luna",
    input="Reply with exactly: OpenAI connection successful."
)


print("=" * 60)
print("OPENAI API TEST")
print("=" * 60)
print()
print(response.output_text)