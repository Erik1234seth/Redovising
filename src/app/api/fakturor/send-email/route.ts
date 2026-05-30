import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface Rad { beskrivning: string; antal: number; enhet: string; apris: number; momssats: number; }
interface MomsRad { sats: number; netto: number; belopp: number; }

interface EmailBody {
  to: string;
  pdfBase64: string;
  fakturaName: string;
  fakturaId: string;
  fakturaInfo: { faktura_nr: string; faktura_datum: string; forfallo_datum: string; betalningsdagar: number; };
  säljarInfo: { company_name: string; full_name: string; adress: string; postnummer: string; ort: string; org_nr: string; momsnr: string; email: string; };
  kundInfo: { namn: string; org_nr: string; adress: string; postnummer: string; ort: string; email: string; };
  rader: Rad[];
  momsByRate: MomsRad[];
  totalExkl: number;
  totalInkl: number;
  betalningsinfo?: string | null;
}

function fmt(n: number) {
  return n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr';
}

export async function POST(request: Request) {
  try {
    const body: EmailBody = await request.json();
    const { to, pdfBase64, fakturaName, fakturaInfo, säljarInfo, kundInfo, rader, momsByRate, totalExkl, totalInkl, betalningsinfo } = body;

    if (!to || !pdfBase64 || !fakturaName) {
      return NextResponse.json({ error: 'Saknar e-post, PDF eller fakturanummer' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json({ error: 'Ogiltig e-postadress' }, { status: 400 });
    }

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const totalMoms = momsByRate.reduce((s, m) => s + m.belopp, 0);

    const raderRows = rader.map(r => `
      <tr>
        <td style="padding:10px 12px;font-size:13px;color:#1e293b;border-bottom:1px solid #f1f5f9;">${r.beskrivning}</td>
        <td style="padding:10px 12px;font-size:13px;color:#1e293b;border-bottom:1px solid #f1f5f9;text-align:right;">${r.antal}</td>
        <td style="padding:10px 12px;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;text-align:center;">${r.enhet}</td>
        <td style="padding:10px 12px;font-size:13px;color:#1e293b;border-bottom:1px solid #f1f5f9;text-align:right;">${fmt(r.apris)}</td>
        <td style="padding:10px 12px;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;text-align:center;">${r.momssats}%</td>
        <td style="padding:10px 12px;font-size:13px;font-weight:600;color:#1e293b;border-bottom:1px solid #f1f5f9;text-align:right;">${fmt(r.antal * r.apris)}</td>
      </tr>`).join('');

    const momsRows = momsByRate.map(m => `
      <tr>
        <td style="padding:5px 0;font-size:13px;color:#64748b;">Moms ${m.sats}% på ${fmt(m.netto)}</td>
        <td style="padding:5px 0;font-size:13px;color:#1e293b;text-align:right;">${fmt(m.belopp)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

        <!-- Header -->
        <tr><td style="background:#173b57;border-radius:16px 16px 0 0;padding:32px 40px;">
          <div style="font-size:11px;font-weight:700;color:#93c5fd;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">FAKTURA</div>
          <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Nr ${fakturaInfo.faktura_nr}</div>
        </td></tr>

        <!-- Från / Till -->
        <tr><td style="background:#ffffff;padding:28px 40px;border-bottom:1px solid #f1f5f9;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:50%;vertical-align:top;padding-right:20px;">
                <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Från</div>
                ${säljarInfo.company_name ? `<div style="font-size:13px;font-weight:700;color:#1e293b;">${säljarInfo.company_name}</div>` : ''}
                ${säljarInfo.full_name ? `<div style="font-size:13px;color:#1e293b;">${säljarInfo.full_name}</div>` : ''}
                ${säljarInfo.adress ? `<div style="font-size:13px;color:#64748b;">${säljarInfo.adress}</div>` : ''}
                ${(säljarInfo.postnummer || säljarInfo.ort) ? `<div style="font-size:13px;color:#64748b;">${[säljarInfo.postnummer, säljarInfo.ort].filter(Boolean).join(' ')}</div>` : ''}
                ${säljarInfo.org_nr ? `<div style="font-size:12px;color:#94a3b8;margin-top:4px;">Org-nr: ${säljarInfo.org_nr}</div>` : ''}
                ${säljarInfo.momsnr ? `<div style="font-size:12px;color:#94a3b8;">Moms-nr: ${säljarInfo.momsnr}</div>` : ''}
                ${säljarInfo.email ? `<div style="font-size:12px;color:#94a3b8;">${säljarInfo.email}</div>` : ''}
              </td>
              <td style="width:50%;vertical-align:top;padding-left:20px;border-left:1px solid #f1f5f9;">
                <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Till</div>
                <div style="font-size:13px;font-weight:700;color:#1e293b;">${kundInfo.namn}</div>
                ${kundInfo.org_nr ? `<div style="font-size:12px;color:#94a3b8;">Org-nr: ${kundInfo.org_nr}</div>` : ''}
                ${kundInfo.adress ? `<div style="font-size:13px;color:#64748b;">${kundInfo.adress}</div>` : ''}
                ${(kundInfo.postnummer || kundInfo.ort) ? `<div style="font-size:13px;color:#64748b;">${[kundInfo.postnummer, kundInfo.ort].filter(Boolean).join(' ')}</div>` : ''}
                ${kundInfo.email ? `<div style="font-size:12px;color:#94a3b8;">${kundInfo.email}</div>` : ''}
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Fakturainformation -->
        <tr><td style="background:#f8fafc;padding:20px 40px;border-bottom:1px solid #e2e8f0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:25%;vertical-align:top;padding-right:12px;">
                <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Fakturadatum</div>
                <div style="font-size:13px;color:#1e293b;">${fakturaInfo.faktura_datum}</div>
              </td>
              <td style="width:25%;vertical-align:top;padding-right:12px;">
                <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Förfallodatum</div>
                <div style="font-size:13px;color:#1e293b;">${fakturaInfo.forfallo_datum}</div>
              </td>
              <td style="width:25%;vertical-align:top;padding-right:12px;">
                <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Fakturanummer</div>
                <div style="font-size:13px;color:#1e293b;">${fakturaInfo.faktura_nr}</div>
              </td>
              <td style="width:25%;vertical-align:top;">
                <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Betalningsvillkor</div>
                <div style="font-size:13px;color:#1e293b;">${fakturaInfo.betalningsdagar} dagar</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Fakturarad-tabell -->
        <tr><td style="background:#ffffff;padding:0 40px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:0;">
            <tr style="background:#f8fafc;">
              <th style="padding:10px 12px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;text-align:left;">Beskrivning</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;text-align:right;">Antal</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;text-align:center;">Enhet</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;text-align:right;">À-pris</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;text-align:center;">Moms</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;text-align:right;">Summa exkl. moms</th>
            </tr>
            ${raderRows}
          </table>
        </td></tr>

        <!-- Summering -->
        <tr><td style="background:#ffffff;padding:20px 40px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="width:60%"></td><td style="width:40%">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #e2e8f0;padding-top:12px;">
                ${momsRows}
                <tr>
                  <td style="padding:5px 0;font-size:13px;color:#64748b;">Totalt exkl. moms</td>
                  <td style="padding:5px 0;font-size:13px;color:#1e293b;text-align:right;">${fmt(totalExkl)}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:4px 0;border-top:1px solid #e2e8f0;"></td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:15px;font-weight:800;color:#173b57;">Totalt att betala</td>
                  <td style="padding:6px 0;font-size:15px;font-weight:800;color:#173b57;text-align:right;">${fmt(totalInkl)}</td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>

        ${betalningsinfo ? `
        <!-- Betalningsinfo -->
        <tr><td style="background:#eff6ff;padding:16px 40px;border-top:1px solid #e2e8f0;">
          <div style="font-size:10px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Betalningsinfo</div>
          <div style="font-size:13px;color:#1e40af;line-height:1.7;white-space:pre-line;">${betalningsinfo}</div>
        </td></tr>` : ''}

        <!-- Footer -->
        <tr><td style="background:#f8fafc;border-radius:0 0 16px 16px;padding:20px 40px;border-top:1px solid #e2e8f0;">
          <p style="font-size:12px;color:#94a3b8;margin:0 0 4px;text-align:center;">
            ${säljarInfo.email ? `Frågor om fakturan? Maila till <a href="mailto:${säljarInfo.email}" style="color:#64748b;">${säljarInfo.email}</a>` : ''}
          </p>
          <p style="font-size:12px;color:#94a3b8;margin:0;text-align:center;">
            Skickat via <strong style="color:#64748b;">Enkla Bokslut</strong>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const { error } = await resend.emails.send({
      from: 'Enkla Bokslut <noreply@enklabokslut.se>',
      to,
      subject: `${fakturaName} från ${säljarInfo.company_name || säljarInfo.full_name}`,
      html,
      attachments: [
        {
          filename: `${fakturaName}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ error: 'Kunde inte skicka e-post' }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error in /api/fakturor/send-email:', err);
    return NextResponse.json({ error: 'Ett oväntat fel inträffade' }, { status: 500 });
  }
}
