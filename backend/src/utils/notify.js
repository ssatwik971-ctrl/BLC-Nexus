/** Create in-app notifications for one or many users. */
export async function notify(ctx, userIds, message, link = null) {
  const ids = [...new Set([].concat(userIds).filter(Boolean))];
  if (!ids.length) return;
  await ctx.prisma.notification.createMany({
    data: ids.map((userId) => ({ userId, message, link })),
  });
}

/** Optional Discord webhook (announcements and new votes). Never throws. */
export async function discordNotify(ctx, content) {
  const url = ctx.config.discordWebhookUrl;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: ctx.config.siteName, content: String(content).slice(0, 1900) }),
    });
  } catch (err) {
    ctx.logger.warn(`discord webhook failed: ${err.message}`);
  }
}

/** Record an admin/officer action in the AuditLog table. */
export async function logAction(ctx, req, action, detail = null) {
  try {
    await ctx.prisma.auditLog.create({
      data: { userId: req.user?.id || null, action, detail, ip: req.ip || null },
    });
  } catch (err) {
    ctx.logger.warn(`audit log failed: ${err.message}`);
  }
}
