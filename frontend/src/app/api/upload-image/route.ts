export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME!;
const API_KEY    = process.env.CLOUDINARY_API_KEY!;
const API_SECRET = process.env.CLOUDINARY_API_SECRET!;

export async function POST(req: NextRequest) {
  try {
    const { base64, mimeType, publicId } = await req.json() as {
      base64: string;
      mimeType: string;
      publicId: string; // ชื่อไฟล์ = SKU
    };

    if (!base64 || !publicId) {
      return NextResponse.json({ error: 'base64 and publicId required' }, { status: 400 });
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = 'khonkaen-pos/products';
    const paramsToSign = `folder=${folder}&overwrite=true&public_id=${publicId}&timestamp=${timestamp}`;
    const signature = crypto
      .createHash('sha256')
      .update(paramsToSign + API_SECRET)
      .digest('hex');

    const formData = new FormData();
    formData.append('file', `data:${mimeType};base64,${base64}`);
    formData.append('public_id', publicId);
    formData.append('folder', folder);
    formData.append('overwrite', 'true');
    formData.append('timestamp', timestamp);
    formData.append('api_key', API_KEY);
    formData.append('signature', signature);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: 'POST', body: formData },
    );

    const json = await res.json() as { secure_url?: string; error?: { message: string } };

    if (json.error) {
      return NextResponse.json({ error: json.error.message }, { status: 500 });
    }

    return NextResponse.json({ url: json.secure_url });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
