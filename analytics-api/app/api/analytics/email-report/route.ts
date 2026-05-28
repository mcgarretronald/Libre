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

    // 1. Initialize the SMTP transport layer
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // 2. Explicitly verify the SMTP connection pool before sending (Crucial for Serverless stability)
    await transporter.verify();

    // 3. Compile the message structural envelope dynamically without hardcoded Shamba Records
    const reportSubject = subject || (brand_context?.name 
      ? `${brand_context.name} Intelligence Report` 
      : 'Analysis Intelligence Report');
    
    const reportFilename = brand_context?.name 
      ? `${brand_context.name.toLowerCase().replace(/\s+/g, '_')}_report.pdf` 
      : 'analytics_report.pdf';

    const mailOptions = {
      from: `"ClickHouse Reports" <${process.env.SMTP_USER}>`,
      to: recipient_email,
      subject: reportSubject,
      html: email_body || html_markup || '<p>Please find attached your requested analytical readout.</p>',
      attachments: [
        {
          filename: reportFilename,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    // 4. Dispatch the message and await completion before releasing the lambda thread
    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent successfully: %s', info.messageId);

    return NextResponse.json({ success: true, message: 'Report dispatched via SMTP link.' });

  } catch (error: any) {
    console.error('SMTP Delivery Engine Crash:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
