import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';
import { LokalniPodsetnik, KorisnikCache } from './storage';

export const PdfService = {
  generisiHtml(item: LokalniPodsetnik, majstor: KorisnikCache): string {
    const datumIzdavanja = new Date().toLocaleDateString('sr-RS');
    const rokDatum = item.rok_datum
      ? new Date(item.rok_datum).toLocaleDateString('sr-RS')
      : 'Po dogovoru';

    const majstorIme = majstor.ime || majstor.korisnicko_ime || 'Majstor';
    const klijentIme = item.klijent_ime || 'Cenjeni klijent';
    const klijentTel = item.klijent_telefon ? `Tel: ${item.klijent_telefon}` : '';
    const lokacija = item.lokacija || 'Na terenu';

    // Generisanje redova tabele
    let tabelaRedovi = '';
    if (item.stavke && item.stavke.length > 0) {
      item.stavke.forEach((st, idx) => {
        tabelaRedovi += `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: center; color: #6B7280;">${idx + 1}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; font-weight: 500;">${st.opis}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: right; font-weight: 600;">
              ${st.iznos.toLocaleString('sr-RS')} ${st.valuta}
            </td>
          </tr>
        `;
      });
    } else {
      tabelaRedovi = `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: center; color: #6B7280;">1</td>
          <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; font-weight: 500;">${item.opis_zadatka || 'Ugovoreni zanatski radovi'}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: right; font-weight: 600;">
            ${item.iznos > 0 ? `${item.iznos.toLocaleString('sr-RS')} ${item.valuta}` : 'Po dogovoru'}
          </td>
        </tr>
      `;
    }

    const ukupnoTekst = `${item.iznos.toLocaleString('sr-RS')} ${item.valuta}`;
    const kaparaTekst = item.je_kapara ? `(Primljena kapara / akontacija)` : '';

    return `
      <!DOCTYPE html>
      <html lang="sr">
      <head>
        <meta charset="utf-8">
        <title>Ponuda / Predračun - ${klijentIme}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1F2937;
            margin: 0;
            padding: 30px;
            background-color: #FFFFFF;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 3px solid #10B981;
            padding-bottom: 20px;
            margin-bottom: 25px;
          }
          .logo-box h1 {
            margin: 0;
            color: #065F46;
            font-size: 26px;
            letter-spacing: -0.5px;
          }
          .logo-box p {
            margin: 4px 0 0 0;
            color: #6B7280;
            font-size: 13px;
          }
          .doc-info {
            text-align: right;
          }
          .doc-info h2 {
            margin: 0;
            font-size: 18px;
            color: #111827;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .doc-info p {
            margin: 3px 0 0 0;
            color: #4B5563;
            font-size: 12px;
          }
          .parties {
            display: flex;
            justify-content: space-between;
            margin-bottom: 25px;
            background: #F9FAFB;
            border-radius: 8px;
            padding: 16px;
          }
          .party-box {
            width: 48%;
          }
          .party-box h3 {
            margin: 0 0 8px 0;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #9CA3AF;
          }
          .party-box p {
            margin: 3px 0;
            font-size: 14px;
            color: #1F2937;
          }
          .table-container {
            margin-bottom: 25px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
          }
          th {
            background-color: #F3F4F6;
            padding: 10px;
            font-weight: 700;
            color: #374151;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
          }
          .summary-box {
            margin-left: auto;
            width: 50%;
            background: #F0FDF4;
            border: 1px solid #BBF7D0;
            border-radius: 8px;
            padding: 14px 18px;
            text-align: right;
          }
          .summary-title {
            font-size: 12px;
            color: #166534;
            font-weight: 600;
            text-transform: uppercase;
          }
          .summary-amount {
            font-size: 24px;
            font-weight: 800;
            color: #15803D;
            margin: 4px 0;
          }
          .notes {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px dashed #E5E7EB;
            font-size: 12px;
            color: #6B7280;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 11px;
            color: #9CA3AF;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-box">
            <h1>🛠️ ${majstorIme}</h1>
            <p>Zanatske usluge i izvođenje radova</p>
          </div>
          <div class="doc-info">
            <h2>SPECIFIKACIJA / PONUDA</h2>
            <p><strong>Datum:</strong> ${datumIzdavanja}</p>
            <p><strong>Rok završetka:</strong> ${rokDatum}</p>
          </div>
        </div>

        <div class="parties">
          <div class="party-box">
            <h3>Izvođač radova</h3>
            <p><strong>${majstorIme}</strong></p>
            <p>Evidencija poslova ZapišiTo</p>
          </div>
          <div class="party-box">
            <h3>Naručilac / Klijent</h3>
            <p><strong>${klijentIme}</strong></p>
            <p>📍 ${lokacija}</p>
            ${klijentTel ? `<p>📞 ${klijentTel}</p>` : ''}
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th style="text-align: left;">Opis radova / Materijal</th>
                <th style="width: 140px; text-align: right;">Iznos</th>
              </tr>
            </thead>
            <tbody>
              ${tabelaRedovi}
            </tbody>
          </table>
        </div>

        <div class="summary-box">
          <div class="summary-title">UKUPNO ZA NAPLATU:</div>
          <div class="summary-amount">${ukupnoTekst}</div>
          ${kaparaTekst ? `<div style="font-size: 12px; color: #854D0E; font-weight: 600;">${kaparaTekst}</div>` : ''}
        </div>

        <div class="notes">
          <p><strong>Napomena:</strong> ${item.opis_zadatka || 'Radovi se izvode u dogovorenom roku po tehničkim standardima.'}</p>
        </div>

        <div class="footer">
          <p>Dokument kreiran automatski pomoću aplikacije <strong>ZapišiTo</strong></p>
        </div>
      </body>
      </html>
    `;
  },

  async otvoriIliPodeliPdf(item: LokalniPodsetnik, majstor: KorisnikCache): Promise<void> {
    try {
      const html = this.generisiHtml(item, majstor);

      if (Platform.OS === 'web') {
        // Na Web-u otvaramo direktan print / save to PDF dijalog
        await Print.printAsync({ html });
      } else {
        // Na mobilnim uređajima (Android/iOS) pravimo pravi PDF fajl i otvaramo deljenje na WhatsApp/Viber
        const { uri } = await Print.printToFileAsync({ html });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            UTI: '.pdf',
            mimeType: 'application/pdf',
            dialogTitle: `Pošalji predračun za ${item.klijent_ime || 'klijenta'}`
          });
        } else {
          Alert.alert('Predračun kreiran', `Fajl je sačuvan na: ${uri}`);
        }
      }
    } catch (error: any) {
      console.error('Greška pri kreiranju PDF-a:', error);
      Alert.alert('Greška', 'Nije uspelo kreiranje predračuna: ' + (error?.message || ''));
    }
  },

  async generisiIDeliPdf(item: LokalniPodsetnik, majstor: KorisnikCache): Promise<void> {
    return this.otvoriIliPodeliPdf(item, majstor);
  }
};
