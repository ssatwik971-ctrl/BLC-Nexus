import { esc } from './http.js';

const button = (href, label) =>
  `<p style="margin:24px 0;"><a href="${esc(href)}" style="background:#d4af37;color:#0a0a0f;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;display:inline-block;">${esc(label)}</a></p>`;

export const inviteEmail = (config, user, token) => {
  const link = `${config.frontendUrl}/accept-invite?token=${token}`;
  return {
    subject: 'Welcome to the Billionaires Club',
    title: `Welcome, ${user.inGameName}`,
    html: `<p>Your BLC application was approved. Activate your account and set a password:</p>${button(link, 'Activate account')}<p style="font-size:12px;color:#8a8aa0;">This link expires in 7 days.</p>`,
    text: `Your BLC application was approved. Activate your account: ${link} (expires in 7 days)`,
  };
};

export const resetEmail = (config, user, token) => {
  const link = `${config.frontendUrl}/reset-password?token=${token}`;
  return {
    subject: 'Reset your password',
    title: 'Password reset',
    html: `<p>Hi ${esc(user.inGameName)}, use the button below to choose a new password.</p>${button(link, 'Reset password')}<p style="font-size:12px;color:#8a8aa0;">This link expires in 1 hour. If you did not ask for it, ignore this email.</p>`,
    text: `Reset your password: ${link} (expires in 1 hour)`,
  };
};

export const applicationReceivedEmail = (config, app, token) => {
  const link = `${config.frontendUrl}/apply/status/${token}`;
  return {
    subject: 'Application received',
    title: 'Application received',
    html: `<p>Thanks ${esc(app.inGameName)} — your application to BLC is in review.</p><p>Track it any time with your private link:</p>${button(link, 'Check application status')}`,
    text: `Application received. Check status: ${link}`,
  };
};

export const applicationDecisionEmail = (config, app, token) => {
  const link = `${config.frontendUrl}/apply/status/${token || ''}`;
  const label = app.status === 'WAITLISTED' ? 'waitlisted' : 'not accepted at this time';
  return {
    subject: 'Application update',
    title: 'Application update',
    html: `<p>Hi ${esc(app.inGameName)}, your BLC application is <strong>${label}</strong>.</p>${app.decisionNote ? `<p>${esc(app.decisionNote)}</p>` : ''}`,
    text: `Your BLC application is ${label}. ${app.decisionNote || ''}`,
  };
};

export const contactEmail = (config, { name, email, message }) => ({
  subject: `Contact form: ${name}`,
  title: 'New contact message',
  html: `<p><strong>${esc(name)}</strong> &lt;${esc(email)}&gt;</p><p style="white-space:pre-wrap;">${esc(message)}</p>`,
  text: `${name} <${email}>\n\n${message}`,
});
