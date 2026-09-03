// Shared HTML/text rendering for Processo Seletivo emails.
// Only escaped, server-controlled values are ever interpolated into markup;
// the confirmation URL is generated internally (never taken from user input).

export const escapeHtml = (value: string): string =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

// Wraps already-escaped text and turns http/https URLs into clickable links.
// Runs only on text produced by escapeHtml, so no raw HTML can be introduced here.
export const linkifyEscapedText = (escapedText: string): string =>
  escapedText.replace(/(https?:\/\/[^\s<]+)/g, (match) => {
    const trailingMatch = match.match(/([.,;:!?)\]]+)$/);
    const trailing = trailingMatch ? trailingMatch[1] : '';
    const url = trailing ? match.slice(0, -trailing.length) : match;
    return `<a href="${url}" style="color:#7c3aed;text-decoration:underline;word-break:break-all;">${url}</a>${trailing}`;
  });

const EMAIL_BRAND_COLOR = '#7c3aed';

function renderEmailShell(innerHtml: string): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VEG System</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f3f4f6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
            <tr>
              <td style="background-color:${EMAIL_BRAND_COLOR};padding:24px 32px;">
                <p style="margin:0;font-size:20px;line-height:24px;font-weight:bold;color:#ffffff;">VEG System</p>
                <p style="margin:4px 0 0;font-size:13px;line-height:18px;color:#ede9fe;">Processo Seletivo</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${innerHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:12px;line-height:16px;color:#9ca3af;">VEG System · Processo Seletivo</p>
                <p style="margin:4px 0 0;font-size:12px;line-height:16px;color:#9ca3af;">Mensagem automática enviada pelo sistema de gestão do processo seletivo.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export type PsEmailInfoFields = {
  evento?: string | null; data_evento?: string | null; cargo?: string | null; campus?: string | null;
  unidade?: string | null; predio?: string | null; andar?: string | null; sala?: string | null; horario?: string | null;
};

// "Informações da atuação" card: only fields with a real value are shown, so
// missing data (e.g. no room/floor) never renders an empty/ugly line.
function buildInfoCardHtml(fields: PsEmailInfoFields): string {
  const campusUnidade = [fields.campus, fields.unidade].map((v) => String(v ?? '').trim()).filter(Boolean).join(' / ');
  const rows: [string, string][] = [
    ['Evento', String(fields.evento ?? '').trim()],
    ['Data', String(fields.data_evento ?? '').trim()],
    ['Cargo', String(fields.cargo ?? '').trim()],
    ['Campus/Unidade', campusUnidade],
    ['Prédio', String(fields.predio ?? '').trim()],
    ['Andar', String(fields.andar ?? '').trim()],
    ['Sala', String(fields.sala ?? '').trim()],
    ['Horário', String(fields.horario ?? '').trim()],
  ].filter(([, value]) => value);
  if (!rows.length) return '';

  const rowsHtml = rows.map(([label, value]) => `
        <tr>
          <td style="padding:6px 0;font-size:13px;line-height:18px;color:#6b7280;">${escapeHtml(label)}</td>
          <td style="padding:6px 0;font-size:14px;line-height:18px;color:#111827;text-align:right;">${escapeHtml(value)}</td>
        </tr>`).join('');

  return `
    <p style="margin:0 0 8px;font-size:12px;line-height:16px;font-weight:bold;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">Informações da atuação</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;margin:0 0 24px;">
      <tr>
        <td style="padding:16px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}
          </table>
        </td>
      </tr>
    </table>`;
}

// Renders the admin-edited (free-form) message body: kept escaped, only
// http/https URLs become links, so the sent HTML always matches the preview.
function buildMessageBodyHtml(text: string): string {
  const linked = linkifyEscapedText(escapeHtml(text)).replace(/\n/g, '<br>');
  return `<div style="font-size:15px;line-height:22px;color:#111827;margin:0 0 24px;">${linked}</div>`;
}

// confirmationUrl is the only value allowed to reach an href; it is generated
// internally (uuid + hex token), never taken from body_template/user input.
export function renderConfirmationEmailHtml(text: string, fields: PsEmailInfoFields, confirmationUrl: string): string {
  const safeUrl = escapeHtml(confirmationUrl);
  const body = `
    <p style="margin:0 0 16px;font-size:19px;line-height:24px;font-weight:bold;color:#111827;">Confirmação de participação</p>
    ${buildMessageBodyHtml(text)}
    ${buildInfoCardHtml(fields)}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;">
      <tr>
        <td style="border-radius:6px;background-color:${EMAIL_BRAND_COLOR};">
          <a href="${safeUrl}" style="display:inline-block;padding:14px 32px;font-size:15px;line-height:20px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px;">Confirmar participação</a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 20px;font-size:12px;line-height:16px;color:#6b7280;text-align:center;">Este link é individual e destinado exclusivamente à sua confirmação.</p>
    <p style="margin:0 0 4px;font-size:13px;line-height:18px;color:#6b7280;">Se o botão não funcionar, copie e cole o endereço abaixo:</p>
    <p style="margin:0;font-size:13px;line-height:18px;word-break:break-all;"><a href="${safeUrl}" style="color:${EMAIL_BRAND_COLOR};">${safeUrl}</a></p>`;

  return renderEmailShell(body);
}

export function renderEventMessageEmailHtml(text: string, fields: PsEmailInfoFields): string {
  const body = `
    <p style="margin:0 0 16px;font-size:19px;line-height:24px;font-weight:bold;color:#111827;">Convocação para Processo Seletivo</p>
    ${buildMessageBodyHtml(text)}
    ${buildInfoCardHtml(fields)}`;
  return renderEmailShell(body);
}
