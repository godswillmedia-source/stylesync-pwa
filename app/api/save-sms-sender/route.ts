import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { userEmail, senderNumber } = await req.json();

    console.log('📱 Saving SMS sender number:', { userEmail, senderNumber });

    if (!userEmail || !senderNumber) {
      return NextResponse.json(
        { error: 'Missing userEmail or senderNumber' },
        { status: 400 }
      );
    }

    // First try to update existing user
    const { data: updateData } = await supabase
      .from('user_tokens')
      .update({ sms_sender_number: senderNumber })
      .eq('user_email', userEmail)
      .select();

    // If user exists, return success
    if (updateData && updateData.length > 0) {
      console.log('✅ Updated existing user SMS sender:', updateData);
      return NextResponse.json({ success: true, data: updateData });
    }

    // User doesn't exist in user_tokens - store in shortcut_downloads instead
    // This allows SMS setup before full account creation
    const { data, error } = await supabase
      .from('shortcut_downloads')
      .upsert(
        {
          user_email: userEmail,
          platform: 'ios',
          clicked_at: new Date().toISOString()
        },
        {
          onConflict: 'user_email,platform'
        }
      )
      .select();

    if (error) {
      console.error('❌ Error saving SMS sender:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log('✅ SMS sender saved successfully:', data);

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('❌ Save SMS sender error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
