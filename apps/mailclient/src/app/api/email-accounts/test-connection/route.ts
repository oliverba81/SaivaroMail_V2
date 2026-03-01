import { NextRequest, NextResponse } from 'next/server';
import Imap from 'imap';
import nodemailer from 'nodemailer';

/**
 * POST /api/email-accounts/test-connection
 * Testet IMAP- und SMTP-Verbindungen
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      imapHost,
      imapPort,
      imapUsername,
      imapPassword,
      imapSsl,
      imapStartTls,
      smtpHost,
      smtpPort,
      smtpUsername,
      smtpPassword,
      smtpSsl,
      smtpStartTls,
    } = body;

    const results: {
      imap?: { success: boolean; message: string; emailCount?: number };
      smtp?: { success: boolean; message: string };
    } = {};

    // IMAP-Verbindungstest
    if (imapHost && imapUsername && imapPassword) {
      try {
        const imapResult = await testImapConnection({
          host: imapHost,
          port: imapPort || (imapSsl ? 993 : 143),
          username: imapUsername,
          password: imapPassword,
          ssl: imapSsl === true,
          startTls: imapStartTls === true,
        });
        results.imap = imapResult;
      } catch (error: any) {
        results.imap = {
          success: false,
          message: error.message || 'IMAP-Verbindung fehlgeschlagen',
        };
      }
    }

    // SMTP-Verbindungstest
    if (smtpHost && smtpUsername && smtpPassword) {
      try {
        const smtpResult = await testSmtpConnection({
          host: smtpHost,
          port: smtpPort || (smtpSsl ? 465 : 587),
          username: smtpUsername,
          password: smtpPassword,
          ssl: smtpSsl === true,
          startTls: smtpStartTls === true,
        });
        results.smtp = smtpResult;
      } catch (error: any) {
        results.smtp = {
          success: false,
          message: error.message || 'SMTP-Verbindung fehlgeschlagen',
        };
      }
    }

    // Wenn keine Tests durchgeführt wurden
    if (!results.imap && !results.smtp) {
      return NextResponse.json(
        { error: 'Bitte geben Sie mindestens IMAP- oder SMTP-Daten an' },
        { status: 400 }
      );
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Fehler beim Verbindungstest:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}

/**
 * Testet eine IMAP-Verbindung
 */
async function testImapConnection(config: {
  host: string;
  port: number;
  username: string;
  password: string;
  ssl: boolean;
  startTls: boolean;
}): Promise<{ success: boolean; message: string; emailCount?: number }> {
  return new Promise((resolve, reject) => {
    let resolved = false;

    const imap = new Imap({
      user: config.username,
      password: config.password,
      host: config.host,
      port: config.port,
      tls: config.ssl, // SSL: verschlüsselte Verbindung von Anfang an (Port 993)
      tlsOptions: { rejectUnauthorized: false }, // Für selbstsignierte Zertifikate
      connTimeout: 10000, // 10 Sekunden Timeout
      authTimeout: 10000,
      debug: (info: string) => {
        // Optional: Debug-Output für Entwicklung
        if (process.env.NODE_ENV === 'development') {
          console.log('IMAP Debug:', info);
        }
      },
    });

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        imap.end();
        reject(new Error('IMAP-Verbindungstest: Timeout nach 10 Sekunden'));
      }
    }, 10000);

    // STARTTLS-Handling: Wenn STARTTLS gewählt wurde, aber nicht SSL
    if (config.startTls && !config.ssl) {
      imap.once('connect', () => {
        // Bei STARTTLS wird die Verbindung erst unverschlüsselt aufgebaut
        // und dann zu TLS aufgewertet (starttls existiert zur Laufzeit, @types/imap deklariert es nicht)
        (imap as Imap & { starttls: (cb: (err: Error | null) => void) => void }).starttls((err) => {
          if (err) {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              imap.end();
              reject(new Error(`IMAP STARTTLS-Fehler: ${err.message}`));
            }
          }
        });
      });
    }

    imap.once('ready', () => {
      // Öffne INBOX, um E-Mail-Anzahl zu ermitteln
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            imap.end();
            resolve({
              success: true,
              message: config.ssl ? 'IMAP SSL-Verbindung erfolgreich' : 'IMAP STARTTLS-Verbindung erfolgreich',
              emailCount: 0,
            });
          }
          return;
        }

        // Zähle E-Mails im Ordner
        const emailCount = box.messages.total || 0;
        
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          imap.end();
          resolve({
            success: true,
            message: config.ssl 
              ? `IMAP SSL-Verbindung erfolgreich (${emailCount} E-Mails im Ordner)` 
              : `IMAP STARTTLS-Verbindung erfolgreich (${emailCount} E-Mails im Ordner)`,
            emailCount: emailCount,
          });
        }
      });
    });

    imap.once('error', (err: Error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        imap.end();
        reject(new Error(`IMAP-Fehler: ${err.message}`));
      }
    });

    imap.connect();
  });
}

/**
 * Testet eine SMTP-Verbindung
 */
async function testSmtpConnection(config: {
  host: string;
  port: number;
  username: string;
  password: string;
  ssl: boolean;
  startTls: boolean;
}): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve, reject) => {
    void (async () => {
      try {
        const transporter = nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.ssl, // SSL: verschlüsselte Verbindung von Anfang an (Port 465)
          auth: {
            user: config.username,
            pass: config.password,
          },
          tls: {
            rejectUnauthorized: false, // Für selbstsignierte Zertifikate
            ciphers: 'SSLv3',
          },
          requireTLS: config.startTls && !config.ssl, // STARTTLS: Verbindung wird zu TLS aufgewertet
        });

        // Teste die Verbindung
        await transporter.verify();

        resolve({
          success: true,
          message: 'SMTP-Verbindung erfolgreich',
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        reject(new Error(`SMTP-Fehler: ${message}`));
      }
    })();
  });
}

