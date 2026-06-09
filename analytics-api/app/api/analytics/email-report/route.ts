import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { recipient_email, html_markup, brand_context, subject, email_body } = await req.json();

    if (!recipient_email) {
      return NextResponse.json({ success: false, error: 'recipient_email is required.' }, { status: 400 });
    }

    if (!html_markup) {
      return NextResponse.json({ success: false, error: 'html_markup is required.' }, { status: 400 });
    }

    const reportSubject = subject || (brand_context?.name
      ? `${brand_context.name} — Jacaranda Health Report`
      : 'Jacaranda Health Analytics Report');

    const reportFilename = brand_context?.name
      ? `${brand_context.name.toLowerCase().replace(/\s+/g, '_')}_report.html`
      : 'jacaranda_report.html';

    // Strip markdown formatting so the body reads cleanly in every email client
    const cleanBody = email_body
      ? email_body.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').trim()
      : 'Please find your Jacaranda Health analytics report attached.';

    const plainText = [
      'Hello,',
      '',
      cleanBody,
      '',
      '---',
      'Automated dispatch from Jacaranda Health Analytics Portal.',
      'To unsubscribe, reply with "UNSUBSCRIBE" in the subject.',
    ].join('\n');

    // The html_markup is the full interactive chart. Attach it as an HTML file
    // so recipients can open it in any browser.
    const htmlBuffer = Buffer.from(html_markup, 'utf-8');

    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: smtpPort === 465,
      family: 4, // Force IPv4 to prevent ENETUNREACH
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    } as any);

    await transporter.verify();

    const info = await transporter.sendMail({
      from: `"Jacaranda Health Analytics" <${process.env.SMTP_USER}>`,
      to: recipient_email,
      subject: reportSubject,
      text: plainText,
      html: undefined,
      attachments: [
        {
          filename: reportFilename,
          content: htmlBuffer,
          contentType: 'text/html',
        },
      ],
    });

    console.log('Email dispatched:', info.messageId);

    return NextResponse.json({ success: true, message: 'Report dispatched with interactive HTML attachment.' });

  } catch (error: any) {
    console.error('SMTP error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
