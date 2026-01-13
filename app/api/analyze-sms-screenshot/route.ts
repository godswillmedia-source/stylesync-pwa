import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  try {
    console.log('🔍 Starting screenshot analysis...');

    const { image } = await req.json();
    console.log('📸 Received image, length:', image?.length || 0);

    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY not found in environment');
      throw new Error('OpenAI API key not configured');
    }
    console.log('✅ OpenAI API key found');

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log('🤖 Calling OpenAI API...');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: image,
              },
            },
            {
              type: 'text',
              text: `Analyze this SMS screenshot. Extract:
1. Sender phone number (short code like 789537, 22395 or full number)
2. Confirm if this is a salon/stylist booking notification
3. Message format pattern

IMPORTANT: Return ONLY raw JSON, no markdown code blocks, no explanation.

Example response format:
{
  "senderNumber": "789537",
  "isStyleSeat": true,
  "confidence": 0.95,
  "messageFormat": "You just got booked! [name] scheduled a [service]..."
}

Look for keywords: "booked", "scheduled", "appointment", "confirmed", client names, service types, dates/times.

If not a booking notification or can't read sender clearly, set confidence < 0.8.`,
            },
          ],
        },
      ],
      max_tokens: 500,
    });

    console.log('✅ OpenAI response received');
    console.log('📝 Raw content:', response.choices[0].message.content);

    // Extract JSON from markdown code blocks if present
    let content = response.choices[0].message.content || '{}';

    // Remove markdown code blocks (```json ... ``` or ``` ... ```)
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    const result = JSON.parse(content);
    console.log('✅ Parsed result:', JSON.stringify(result));

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('❌ Screenshot analysis error:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type
    });

    return NextResponse.json(
      {
        error: 'Failed to analyze screenshot',
        details: error.message
      },
      { status: 500 }
    );
  }
}
