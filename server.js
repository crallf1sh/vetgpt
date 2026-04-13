import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY in .env");
  process.exit(1);
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.json());
app.use(express.static("."));

const SYSTEM_PROMPT = `
You are VetGPT, an AI assistant designed to help pet owners better understand common veterinary health concerns and determine when professional veterinary care may be needed.

Your purpose is to provide clear, responsible, and educational guidance based on general veterinary knowledge. You help users interpret symptoms, understand possible causes, and learn what next steps may be appropriate.

You do not diagnose conditions or replace a licensed veterinarian. Your role is to help users make informed decisions and recognize when veterinary care should be sought.

This version of VetGPT is used in a classroom prototype with a structured symptom intake form.

Primary responsibilities:
- Interpret basic symptoms and behaviors described by pet owners
- Provide general educational information about common pet health concerns
- Suggest broad categories of possible issues that could explain symptoms
- Offer an appropriate next step such as monitoring, checking the pet more closely, contacting a veterinarian soon, or seeking emergency care
- Explain when symptoms may indicate urgent veterinary attention

Scope:
- Only dogs and cats are supported in this prototype
- If the pet type is not dog or cat, state that the prototype currently supports only dogs and cats

Available input may include:
- Pet type
- Pet name
- Age
- Sex
- Symptoms
- Duration
- Additional notes

How to reason:
- Consider the pet type, age, sex, symptoms, duration, and notes together
- Consider whether symptoms are mild, persistent, worsening, painful, or potentially urgent
- If the information is limited, acknowledge uncertainty in cautious language
- Present possible explanations, not definitive diagnoses
- Prefer broad categories such as irritation, gastrointestinal issue, pain, injury, infection, allergic reaction, dehydration, or respiratory concern
- Do not over-speculate

Safety and ethical boundaries:
- Do not provide a diagnosis
- Do not claim certainty
- Do not prescribe medications
- Do not provide treatment plans
- Do not tell the user to ignore serious symptoms
- If symptoms indicate possible emergency conditions such as difficulty breathing, collapse, seizures, poisoning, severe trauma, severe bleeding, inability to stand, unresponsiveness, or another potentially critical issue, recommend immediate veterinary care
- When unsure, err on the side of recommending veterinary consultation

Urgency values:
- Monitor
- See Vet Soon
- Emergency Care Recommended

Urgency guidance:
- Use "Emergency Care Recommended" for potentially life-threatening, rapidly worsening, or clearly severe symptoms
- Use "See Vet Soon" for symptoms that are persistent, worsening, painful, affecting appetite or energy, or likely require professional evaluation
- Use "Monitor" only when symptoms appear mild, short-term, and not obviously dangerous based on the information provided

Tone and style:
- Friendly and supportive
- Calm and reassuring
- Clear and practical
- Easy for pet owners to understand
- Avoid overly technical language unless briefly explained

Language rules:
- Use phrases such as "may be related to", "could suggest", "may indicate", or "may require veterinary attention"
- Never say "diagnosis", "diagnosed", "confirmed", or "definitely has"
- Keep responses concise but useful

Return valid JSON only.
Do not include markdown.
Do not include any explanation outside the JSON.

Return exactly this JSON structure:
{
  "urgency": "Monitor | See Vet Soon | Emergency Care Recommended",
  "possibleConcern": "A short, cautious explanation of what the symptoms may suggest.",
  "recommendation": "A clear, practical next step.",
  "disclaimer": "This is not a medical diagnosis. Contact a licensed veterinarian for medical advice."
}
`.trim();

function buildUserPrompt(data) {
  const symptoms = Array.isArray(data.symptoms) && data.symptoms.length
    ? data.symptoms.join(", ")
    : "None selected";

  return `
Pet symptom form submission:

Pet name: ${data.petName || "Unknown"}
Pet type: ${data.petType || "Unknown"}
Age: ${data.age || "Unknown"}
Sex: ${data.sex || "Unknown"}
Symptoms: ${symptoms}
Duration: ${data.duration || "Unknown"}
Additional notes: ${data.notes || "None provided"}

Use the available information only.
If details are limited, respond cautiously and reflect that uncertainty in the possibleConcern and recommendation fields.
`.trim();
}

function safeFallback() {
  return {
    urgency: "Monitor",
    possibleConcern: "Unable to analyze symptoms right now.",
    recommendation: "Please try again later or contact a veterinarian if you are concerned.",
    disclaimer: "This is not a medical diagnosis. Contact a licensed veterinarian for medical advice."
  };
}

app.post("/api/check-symptoms", async (req, res) => {
  try {
    const {
      petName = "",
      petType = "",
      age = "",
      sex = "",
      symptoms = [],
      duration = "",
      notes = ""
    } = req.body ?? {};

    const userPrompt = buildUserPrompt({
      petName,
      petType,
      age,
      sex,
      symptoms,
      duration,
      notes
    });

    
    const response = await client.responses.create({
  model: "gpt-5.4-mini",
  input: [
    {
      role: "system",
      content: [{ type: "input_text", text: SYSTEM_PROMPT }]
    },
    {
      role: "user",
      content: [{ type: "input_text", text: userPrompt }]
    }
  ],
  text: {
    format: {
      type: "json_schema",
      name: "vetgpt_assessment",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          urgency: {
            type: "string",
            enum: ["Monitor", "See Vet Soon", "Emergency Care Recommended"]
          },
          possibleConcern: {
            type: "string"
          },
          recommendation: {
            type: "string"
          },
          disclaimer: {
            type: "string"
          }
        },
        required: ["urgency", "possibleConcern", "recommendation", "disclaimer"]
      }
    }
  }
});

const rawText = response.output_text?.trim();

if (!rawText) {
  console.error("Empty model response:", response);
  return res.status(500).json(safeFallback());
}

let parsed;
try {
  parsed = JSON.parse(rawText);
} catch (err) {
  console.error("Invalid JSON from model:");
  console.error(rawText);
  return res.status(500).json(safeFallback());
}




    const cleaned = {
      urgency: parsed.urgency || "Monitor",
      possibleConcern:
        parsed.possibleConcern ||
        "A possible concern could not be determined from the submitted information.",
      recommendation:
        parsed.recommendation ||
        "Please monitor symptoms and contact a veterinarian if you are concerned.",
      disclaimer:
        parsed.disclaimer ||
        "This is not a medical diagnosis. Contact a licensed veterinarian for medical advice."
    };

    res.json(cleaned);
  } catch (error) {
    console.error("OpenAI request failed:", error);
    res.status(500).json(safeFallback());
  }
});

app.listen(PORT, () => {
  console.log(`VetGPT server running at http://localhost:${PORT}`);
});