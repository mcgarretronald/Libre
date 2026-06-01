import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Force Node runtime for serverless execution
export const maxDuration = 60; // Extend timeout for headless browser + SMTP execution
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { recipient_email, html_markup, brand_context, subject, email_body } = await req.json();

    if (!recipient_email) {
      return NextResponse.json(
        { success: false, error: 'recipient_email is required.' },
        { status: 400 }
      );
    }

    if (!html_markup) {
      return NextResponse.json(
        { success: false, error: 'html_markup is required.' },
        { status: 400 }
      );
    }

    // Convert HTML string to Buffer
    const htmlBuffer = Buffer.from(html_markup, 'utf-8');

    // 1. Compile the message structural envelope dynamically
    const reportSubject = subject || (brand_context?.name 
      ? `${brand_context.name} Intelligence Report` 
      : 'Analysis Intelligence Report');
    
    const reportFilename = brand_context?.name 
      ? `${brand_context.name.toLowerCase().replace(/\s+/g, '_')}_report.html` 
      : 'jacaranda_interactive_report.html';

    // Format the email body beautifully if it is custom
    let mailText: string;
    if (email_body) {
      // Strip markdown tags from raw text to avoid any jargon
      mailText = email_body.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
    } else {
      mailText = 'Please find attached your requested interactive analytical dashboard.';
    }

    // 2. Initialize the SMTP transport layer using pure Nodemailer
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    console.log(`Initializing Nodemailer SMTP transport on host: ${process.env.SMTP_HOST}, port: ${smtpPort}, secure: ${smtpPort === 465}`);
    
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for other ports (GMail requires STARTTLS for 587)
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // 3. Explicitly verify the SMTP connection pool before sending
    await transporter.verify();

    const mailOptions = {
      from: `"Jacaranda Health Analytics" <${process.env.SMTP_USER}>`,
      to: recipient_email,
      subject: reportSubject,
      text: mailText,
      html: undefined,
      attachments: [
        {
          filename: reportFilename,
          content: htmlBuffer,
          contentType: 'text/html'
        }
      ]
    };

    // 4. Dispatch the message and await completion
    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent successfully via SMTP: %s', info.messageId);

    return NextResponse.json({ success: true, message: 'Report dispatched via SMTP with HTML attachment.' });

  } catch (error: any) {
    console.error('SMTP Delivery Engine Crash:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
