import nodemailer from 'nodemailer';
import { esc } from './http.js';

/** Branded black/gold HTML wrapper used by every BLC Nexus email. */
export function emailLayout(config, title, bodyHtml) {
  return `<!doctype html>
<html><body style="margin:0;background:#0a0a0f;font-family:Inter,Arial,sans-serif;color:#e8e8ee;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0b1530;border:1px solid #d4af37;border-radius:12px;">
<tr><td style="padding:28px 32px 8px;text-align:center;">
<div style="font-size:28px;font-weight:800;letter-spacing:4px;color:#d4af37;">BLC</div>
<div style="font-size:11px;letter-spacing:8px;color:#b8b8c8;margin-top:2px;">N E X U S</div>
</td></tr>
<tr><td style="padding:16px 32px 8px;">
<h1 style="font-size:20px;margin:0 0 12px;color:#f2d675;">${esc(title)}</h1>
<div style="font-size:15px;line-height:1.6;">${bodyHtml}</div>
</td></tr>
<tr><td style="padding:20px 32px 28px;font-size:12px;color:#8a8aa0;border-top:1px solid #1d2a52;">
${esc(config.siteName)} — ${esc(config.tagline)}<br/>
Unofficial fan companion site for Ticarium: Business Tycoon.
</td></tr></table></td></tr></table></body></html>`;
}

export function createMailer(config, logger) {
  const transport = config.smtp.host
    ? nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
      })
    : null;

  return {
    /** Never throws: a failed email must not break the action that triggered it. */
    async send({ to, subject, title, html, text }) {
      const fullSubject = `${config.siteName} — ${subject}`;
      if (!transport) {
        logger.info(`[mail:dev] to=${to} subject="${fullSubject}"\n${text || ''}`);
        return { logged: true };
      }
      try {
        await transport.sendMail({
          from: config.mailFrom,
          to,
          subject: fullSubject,
          html: emailLayout(config, title || subject, html),
          text,
        });
        return { sent: true };
      } catch (err) {
        logger.error(`mail failed: ${err.message}`);
        return { sent: false };
      }
    },
  };
}
