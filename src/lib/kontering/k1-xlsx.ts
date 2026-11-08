import * as XLSX from 'xlsx';
import type { k1Fil, Parameter, Regel } from './regelverk';

/**
 * Nedladdningarna som xlsx, med de engelska kolumnnamnen och listor
 * separerade med |:
 *   - kontobeskrivningarna: fliken Kontobeskrivningar (gränsvärdena ligger i en egen fil)
 *   - gränsvärdena: fliken Gränsvärden, bara parametertabellen (value_id)
 *   - regelmasterns regler: fliken Regler (rule_id)
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

/** Fliken Regler: regelmasterns regler i en kontoplan, med rubrikraden rule_id. */
export function reglerXlsx(regler: Regel[]): Buffer {
  const rader: (string | number)[][] = [[
    'rule_id', 'rule_name', 'value_id', 'comparison_operator', 'aggregation_scope', 'vat_treatment',
    'valid_from', 'valid_to', 'applies_to_accounts', 'rule_notes', 'status', 'version',
  ]];
  for (const r of regler) {
    rader.push([
      r.id, r.namn, r.parameterId, r.operator, r.omfattning, r.moms, r.gallerFran ?? '', r.gallerTill ?? '',
      lista(r.konton), r.anteckning, 'active', r.version ?? '',
    ]);
  }
  return bok(rader, 'Regler', [{ wch: 44 }, { wch: 50 }, { wch: 40 }]);
}

function bok(rader: (string | number)[][], flik: string, cols: XLSX.ColInfo[]): Buffer {
  const wb = XLSX.utils.book_new();
  const ark = XLSX.utils.aoa_to_sheet(rader);
  ark['!cols'] = cols;
  XLSX.utils.book_append_sheet(wb, ark, flik);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
