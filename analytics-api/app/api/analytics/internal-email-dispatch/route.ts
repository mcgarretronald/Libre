import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET || 'jacaranda-default-secret';
    
    if (authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { to, subject, text, attachmentName, attachmentBase64 } = await req.json();

    if (!to || !subject || !text) {
      return NextResponse.json({ success: false, error: 'Missing required fields (to, subject, text)' }, { status: 400 });
    }

    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: smtpPort === 465,
      family: 4,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    } as any);

    const attachments = [];
    if (attachmentBase64 && attachmentName) {
      attachments.push({
        filename: attachmentName,
        content: Buffer.from(attachmentBase64, 'base64'),
        contentType: 'application/pdf',
      });
    }

    const info = await transporter.sendMail({
      from: `"Jacaranda Analytics" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html: undefined,
      attachments,
    });

    console.log('Internal email dispatched:', info.messageId);

    return NextResponse.json({ success: true, messageId: info.messageId });

  } catch (error: any) {
    console.error('SMTP internal dispatch error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
