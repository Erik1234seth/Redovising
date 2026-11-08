import * as XLSX from 'xlsx';
import type { k1Fil } from './regelverk';

/**
 * Kontobeskrivningarna som xlsx, i samma form som filen k1.json byggs från:
 * flikarna Kontobeskrivningar och Gränsvärden med de engelska kolumnnamnen
 * och listor separerade med |. Filen kan alltså läsas in igen med
 * `npm run k1 -- fil.xlsx` (scripts/k1-till-json.mjs).
 *
 * Gränsvärden har två tabeller under varandra: parametrarna, en tom rad och
 * sedan reglerna med en egen rubrikrad (rule_id).
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

  const granser: (string | number)[][] = [[
    'value_id', 'parameter_name', 'value', 'unit', 'valid_from', 'valid_to', 'parameter_type',
    'base_parameter_id', 'multiplier', 'last_verified_at', 'status', 'version',
  ]];
  for (const p of fil.parametrar) {
    granser.push([
      p.id, p.namn, p.varde, p.enhet, p.gallerFran ?? '', p.gallerTill ?? '', p.typ ?? '',
      p.basParameter ?? '', p.multiplikator ?? '', p.senastKontrollerad ?? '', 'active', p.version ?? '',
    ]);
  }
  granser.push([]);
  granser.push([
    'rule_id', 'rule_name', 'value_id', 'comparison_operator', 'aggregation_scope', 'vat_treatment',
    'valid_from', 'valid_to', 'applies_to_accounts', 'rule_notes', 'status', 'version',
  ]);
  for (const r of fil.regler) {
    granser.push([
      r.id, r.namn, r.parameterId, r.operator, r.omfattning, r.moms, r.gallerFran ?? '', r.gallerTill ?? '',
      lista(r.konton), r.anteckning, 'active', r.version ?? '',
    ]);
  }

  const wb = XLSX.utils.book_new();
  const ark1 = XLSX.utils.aoa_to_sheet(konton);
  ark1['!cols'] = [{ wch: 8 }, { wch: 32 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, ark1, 'Kontobeskrivningar');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(granser), 'Gränsvärden');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
