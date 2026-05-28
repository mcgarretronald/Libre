import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';
import { Resend } from 'resend';
import fs from 'fs';

const resend = new Resend(process.env.RESEND_API_KEY);

// Force Node runtime for serverless execution
export const maxDuration = 60; // Extend timeout for binary unpacking
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { recipient_email, query_used, html_markup } = await req.json();

    if (!recipient_email) {
      return NextResponse.json(
        { success: false, error: 'recipient_email is required.' },
        { status: 400 }
      );
    }

    if (!html_markup) {
      return NextResponse.json(
        { success: false, error: 'html_markup is required to generate a high-fidelity PDF report.' },
        { status: 400 }
      );
    }

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

    // 3. Set HTML content and wait for full load & network synchronization
    await page.setContent(html_markup, { waitUntil: ['load', 'domcontentloaded', 'networkidle0'] });


    // 3.1. Wait for canvas element to be fully mounted in the DOM to prevent empty snapshots
    try {
      await page.waitForSelector('canvas', { timeout: 5000 });
      // Add a slight delay to ensure Chart.js transitions and animation loops are completed
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (e: any) {
      console.warn('Canvas selector wait timed out or was not present:', e.message);
    }

    // 4. Generate A4 PDF buffer
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
    });

    await browser.close();

    // 5. Send email with PDF attachment via Resend
    await resend.emails.send({
      from: 'ClickHouse Reports <onboarding@resend.dev>',
      to: recipient_email,
      subject: 'Analysis Intelligence Report',
      html: '<p>Please find attached your requested high-fidelity analytical business readout.</p>',
      attachments: [
        {
          filename: 'Report.pdf',
          content: pdfBuffer,
        },
      ],
    });

    return NextResponse.json({ success: true, message: 'High-fidelity PDF dispatched.' });

  } catch (error: any) {
    console.error('Serverless PDF Engine Generation Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
