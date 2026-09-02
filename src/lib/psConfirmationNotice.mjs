export const PS_CONFIRMATION_NOTICE_CHANNELS = Object.freeze(['copy_link', 'email_future']);

export function buildPsConfirmationNotice({ collaboratorName, eventName, confirmationUrl, expiresAt }) {
  if (!confirmationUrl) throw new Error('confirmation_url_required');
  return {
    subject: `Confirmação de participação — ${eventName}`,
    text: `Olá, ${collaboratorName}. Confirme ou recuse sua participação em ${eventName}: ${confirmationUrl}\nO link expira em ${expiresAt}.`,
  };
}

// Contrato para um provedor futuro. Esta fase deliberadamente não envia mensagens.
export function createPsConfirmationDeliveryRequest({ channel = 'copy_link', recipient, notice }) {
  if (!PS_CONFIRMATION_NOTICE_CHANNELS.includes(channel)) throw new Error('unsupported_confirmation_channel');
  return { channel, recipient: recipient || null, notice, dispatch: false };
}
