export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message: string };
};

async function callGemini(base64Image: string, mediaType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: mediaType,
                data: base64Image,
              },
            },
            {
              text: `You are an OCR engine for a retail POS system. Read ALL text visible on the product packaging.

Return ONLY a JSON object — no markdown, no explanation:
{
  "nameTh": "<product name in Thai, read directly from packaging — empty string if not visible>",
  "nameEn": "<product name in English, read directly from packaging — if not visible, translate the Thai name to English>",
  "barcode": "<barcode number printed on packaging, digits only — empty string if not visible>"
}`,
            },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 256, temperature: 0 },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = await res.json() as GeminiResponse;
  if (json.error) throw new Error(json.error.message);

  return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
}

function parseJson(raw: string): { nameTh: string; nameEn: string; barcode: string } {
  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const clean = raw.replace(/```(?:json)?/gi, '').trim();
  // Extract first {...} block
  const match = clean.match(/\{[\s\S]*\}/);
  const jsonStr = match ? match[0] : clean;
  try {
    const parsed = JSON.parse(jsonStr) as { nameTh?: string; nameEn?: string; barcode?: string };
    return {
      nameTh:  String(parsed.nameTh  ?? ''),
      nameEn:  String(parsed.nameEn  ?? ''),
      barcode: String(parsed.barcode ?? ''),
    };
  } catch {
    return { nameTh: '', nameEn: '', barcode: '' };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { productImage } = await req.json() as {
      productImage: { data: string; mediaType: string };
    };

    if (!productImage?.data) {
      return NextResponse.json({ error: 'Product image required' }, { status: 400 });
    }

    const raw = await callGemini(productImage.data, productImage.mediaType || 'image/jpeg');
    const result = parseJson(raw);
    return NextResponse.json(result);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
