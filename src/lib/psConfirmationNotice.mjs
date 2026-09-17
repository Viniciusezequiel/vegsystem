export const PS_CONFIRMATION_NOTICE_CHANNELS = Object.freeze(['copy_link', 'email_future']);

export function buildPsConfirmationNotice({ collaboratorName, eventName, confirmationUrl, expiresAt, eventDate }) {
  if (!confirmationUrl) throw new Error('confirmation_url_required');
  const eventDateLine = eventDate ? `, no dia ${eventDate}` : '';
  const expirationLine = expiresAt ? `\n\nEste link expira em ${expiresAt}.` : '';
  return {
    subject: `Confirmação de participação — ${eventName}`,
    text: `Olá, ${collaboratorName}!\n\nVocê foi selecionado(a) para atuar no evento ${eventName}${eventDateLine}.\n\nConfirme ou recuse sua participação pelo link abaixo:\n${confirmationUrl}\n\nConsulte o valor, cargo e área de atuação através da Intranet.${expirationLine}`,
  };
}

export function getPsContactPhone(person = {}) {
  return String(person.mobile || person.phone || '').trim();
}

export function getPsWhatsAppUrl(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const international = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  return `https://wa.me/${international}`;
}

// Contrato para um provedor futuro. Esta fase deliberadamente não envia mensagens.
export function createPsConfirmationDeliveryRequest({ channel = 'copy_link', recipient, notice }) {
  if (!PS_CONFIRMATION_NOTICE_CHANNELS.includes(channel)) throw new Error('unsupported_confirmation_channel');
  return { channel, recipient: recipient || null, notice, dispatch: false };
}
