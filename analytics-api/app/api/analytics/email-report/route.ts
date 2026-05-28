import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';
import nodemailer from 'nodemailer';
import fs from 'fs';

// Force Node runtime for serverless execution
export const maxDuration = 60; // Extend timeout for headless browser + SMTP execution
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { recipient_email, query_used, html_markup, brand_context, pdfBuffer: incomingPdfBuffer, subject, email_body } = await req.json();

    if (!recipient_email) {
      return NextResponse.json(
        { success: false, error: 'recipient_email is required.' },
        { status: 400 }
      );
    }

    if (!html_markup && !incomingPdfBuffer) {
      return NextResponse.json(
        { success: false, error: 'html_markup or pdfBuffer is required.' },
        { status: 400 }
      );
    }

    let pdfBuffer: Buffer;

    if (incomingPdfBuffer) {
      // Reconstruct buffer from incoming base64 string
      pdfBuffer = Buffer.from(incomingPdfBuffer, 'base64');
    } else {
      let browser;
      // Detect environment
      const isLocal = process.env.NODE_ENV !== 'production' || !process.env.VERCEL;

      if (isLocal) {
        // On local development, find standard Chrome/Chromium paths
        const localPaths = [
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
          '/usr/bin/chromium-browser',
          '/usr/bin/chromium',
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        ];
        let localPath = '';
        for (const p of localPaths) {
          if (fs.existsSync(p)) {
            localPath = p;
            break;
          }
        }
        
        console.log('Launching local Puppeteer using executable:', localPath);
        browser = await puppeteer.launch({
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
          executablePath: localPath || undefined,
          headless: true,
        });
      } else {
        // In production (Vercel/serverless)
        const chromiumAny = chromium as any;
        const arch = process.arch;
        const remoteUrl = `https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.${arch === 'arm64' ? 'arm64' : 'x64'}.tar`;
        console.log('Launching Vercel serverless Puppeteer using remote pack:', remoteUrl);
        const executablePath = await chromiumAny.executablePath(remoteUrl);
        
        browser = await puppeteer.launch({
          args: chromiumAny.args,
          defaultViewport: chromiumAny.defaultViewport,
          executablePath: executablePath,
          headless: chromiumAny.headless === 'shell' ? 'shell' : true, 
        });
      }

      const page = await browser.newPage();

      // Listen to page console and error events for debugging
      page.on('console', msg => console.log('PUPPETEER PAGE LOG:', msg.text()));
      page.on('pageerror', err => console.error('PUPPETEER PAGE ERROR:', err.message));

      // Set HTML content and wait for full load & network synchronization
      await page.setContent(html_markup, { waitUntil: ['load', 'domcontentloaded', 'networkidle0'] });

      // Wait for canvas element to be fully mounted in the DOM to prevent empty snapshots
      try {
        await page.waitForSelector('canvas', { timeout: 5000 });
        // Add a slight delay to ensure Chart.js transitions and animation loops are completed
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (e: any) {
        console.warn('Canvas selector wait timed out or was not present:', e.message);
      }

      // Generate A4 PDF buffer
      const generatedPdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
      });

      await browser.close();
      pdfBuffer = Buffer.from(generatedPdf);
    }

    // 1. Compile the message structural envelope dynamically
    const reportSubject = subject || (brand_context?.name 
      ? `${brand_context.name} Intelligence Report` 
      : 'Analysis Intelligence Report');
    
    const reportFilename = brand_context?.name 
      ? `${brand_context.name.toLowerCase().replace(/\s+/g, '_')}_report.pdf` 
      : 'analytics_report.pdf';

    // Format the email body beautifully if it is custom
    let mailHtml: string;
    if (email_body) {
      // If email_body has HTML tags already, use it directly.
      // Otherwise, convert Markdown/plain text into clean, styled HTML
      if (email_body.includes('<') && email_body.includes('>')) {
        mailHtml = email_body;
      } else {
        // Convert Markdown bold and newlines to HTML
        let formattedBody = email_body
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/\n/g, '<br>');
        
        mailHtml = `
          <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #334155; line-height: 1.6;">
            <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
              <h3 style="margin-top: 0; color: #1e3a8a;">Executive Report Summary</h3>
              <p style="margin: 0; font-size: 14px;">${formattedBody}</p>
            </div>
            <p style="font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 20px;">
              Please find your high-fidelity, interactive PDF report attached to this email.
            </p>
          </div>
        `;
      }
    } else {
      mailHtml = html_markup || '<p>Please find attached your requested analytical readout.</p>';
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
      from: `"ClickHouse Reports" <${process.env.SMTP_USER}>`,
      to: recipient_email,
      subject: reportSubject,
      html: mailHtml,
      attachments: [
        {
          filename: reportFilename,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    // 4. Dispatch the message and await completion
    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent successfully via SMTP: %s', info.messageId);

    return NextResponse.json({ success: true, message: 'Report dispatched via SMTP link.' });

  } catch (error: any) {
    console.error('SMTP Delivery Engine Crash:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
