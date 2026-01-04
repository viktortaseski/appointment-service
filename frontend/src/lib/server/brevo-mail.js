import { debugLog } from './debug';

export async function sendBrevoEmail({
  to,
  subject,
  text,
  senderName,
  templateId,
  params,
}) {
  if (!process.env.BREVO_API_KEY) {
    debugLog('brevo: missing api key');
  }

  const payload = {
    sender: {
      name: senderName || 'Dentra',
      email: 'appointments@dentra.mk',
    },
    to: [{ email: to }],
  };

  if (templateId) {
    payload.templateId = templateId;
    if (params) {
      payload.params = params;
    }
  } else {
    payload.subject = subject;
    payload.textContent = text;
  }

  debugLog('brevo: send start', {
    to: Boolean(to),
    subject: Boolean(subject),
    templateId: Boolean(templateId),
  });

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    // eslint-disable-next-line no-console
    console.error('Brevo API error:', data);
    throw new Error('Brevo email failed');
  }

  debugLog('brevo: send success', { messageId: data?.messageId });

  return data;
}
