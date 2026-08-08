import { NextResponse } from 'next/server';
import { sendTicketNotificationEmail } from '@/lib/email/notifications';

export async function POST(req: Request) {
  try {
    const { props, recipients } = await req.json();
    
    if (!props || !recipients) {
      return NextResponse.json({ error: 'Missing props or recipients' }, { status: 400 });
    }

    await sendTicketNotificationEmail(props, recipients);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API/Emails] Erro no envio de e-mail:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
