import * as XLSX from 'xlsx';
import type { k1Fil, Parameter } from './regelverk';
import type { AiRegel } from './airegler';
import { AI_KOLUMNER } from './regelmaster';

/**
 * Nedladdningarna som xlsx, med de engelska kolumnnamnen och listor
 * separerade med |:
 *   - kontobeskrivningarna: fliken Kontobeskrivningar (gränsvärdena ligger i en egen fil)
 *   - gränsvärdena: fliken Gränsvärden, bara parametertabellen (value_id)
 *   - regelmasterns AI-regler: fliken "AI-regler löpande"/"AI-regler bokslut" med byråns svenska rubriker
 */

const lista = (v: string[] | undefined) => (v ?? []).join('|');

export function k1Xlsx(fil: ReturnType<typeof k1Fil>): Buffer {
  const konton: (string | number)[][] = [[
    'account_number', 'account_name', 'short_description', 'use_when', 'do_not_use_when', 'decision_rules',
    'common_counter_accounts', 'examples', 'warnings', 'keywords', 'related_accounts', 'needs_human_review',
    'status', 'version', 'threshold_references', 'draft_reason',
  ]];
  for (const k of fil.konton) {
    konton.push([
      k.konto, k.namn, k.beskrivning, lista(k.anvandNar), lista(k.anvandInteNar), lista(k.beslutsregler),
      lista(k.motkonton), lista(k.exempel), lista(k.varningar), lista(k.nyckelord), lista(k.relateradeKonton), lista(k.granskningNar),
      'active', k.version ?? '', lista(k.trosklar), k.utkastOrsak ?? '',
    ]);
  }

  const wb = XLSX.utils.book_new();
  const ark1 = XLSX.utils.aoa_to_sheet(konton);
  ark1['!cols'] = [{ wch: 8 }, { wch: 32 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, ark1, 'Kontobeskrivningar');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/** Fliken Gränsvärden: bara parametrarna, samma form som byråns gränsvärdesfil. */
export function gransvardenXlsx(parametrar: Parameter[]): Buffer {
  const granser: (string | number)[][] = [[
    'value_id', 'parameter_name', 'value', 'unit', 'valid_from', 'valid_to', 'parameter_type',
    'base_parameter_id', 'multiplier', 'last_verified_at', 'status', 'version',
  ]];
  for (const p of parametrar) {
    granser.push([
      p.id, p.namn, p.varde, p.enhet, p.gallerFran ?? '', p.gallerTill ?? '', p.typ ?? '',
      p.basParameter ?? '', p.multiplikator ?? '', p.senastKontrollerad ?? '', 'active', p.version ?? '',
    ]);
  }
  return bok(granser, 'Gränsvärden', [{ wch: 44 }, { wch: 50 }, { wch: 10 }, { wch: 16 }]);
}

/** Regelmasterns AI-regler i en kontoplan, med samma kolumner som byråns regelmasterfil. */
export function aiReglerXlsx(regler: AiRegel[], flik: string): Buffer {
  const rader: string[][] = [AI_KOLUMNER.map(([, rubrik]) => rubrik)];
  for (const r of regler) rader.push(AI_KOLUMNER.map(([f]) => r[f]));
  return bok(rader, flik, [{ wch: 14 }, { wch: 28 }, { wch: 50 }, { wch: 70 }, { wch: 50 }]);
}

function bok(rader: (string | number)[][] | string[][],flik: string, cols: XLSX.ColInfo[]): Buffer {
  const wb = XLSX.utils.book_new();
  const ark = XLSX.utils.aoa_to_sheet(rader);
  ark['!cols'] = cols;
  XLSX.utils.book_append_sheet(wb, ark, flik);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
