/**
 * 메일 보내기 (비밀번호 재설정). RESEND_API_KEY와 MAIL_FROM이 있으면 Resend로 보내고,
 * 없으면(개발) 콘솔에 내용을 찍고 성공으로 친다
 */
/** 운영에서 메일 설정이 없으면 재설정 메일을 보낼 수 없다 — 라우트가 503으로 알려 UI가 안내한다 */
export const mailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

export async function sendMail(mail: { to: string; subject: string; html: string; text: string }): Promise<boolean> {
  const { RESEND_API_KEY, MAIL_FROM } = process.env;
  if (!RESEND_API_KEY || !MAIL_FROM) {
    console.log('[mail]', mail.to, mail.subject, '\n' + mail.text);
    return true;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: MAIL_FROM, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text }),
    });
    if (!res.ok) console.error('[mail] resend', res.status, await res.text().catch(() => ''));
    return res.ok;
  } catch (error) {
    console.error('[mail] resend', error);
    return false;
  }
}
