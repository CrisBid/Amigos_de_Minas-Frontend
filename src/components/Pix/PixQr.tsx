'use client';

import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';

/* ========= Helpers PIX ========= */

function crc16(str: string) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= (str.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) crc = (crc << 1) ^ 0x1021;
      else crc = crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(id: string, value?: string | null) {
  if (value === undefined || value === null) return '';
  const v = String(value);
  const len = v.length.toString().padStart(2, '0');
  return `${id}${len}${v}`;
}

function sanitizeAscii(s: string, max?: number) {
  const noAccent = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const ascii = noAccent.replace(/[^\x20-\x7E]/g, '');
  const trimmed = ascii.trim();
  return max ? trimmed.slice(0, max) : trimmed;
}

function normalizePixKey(raw: string) {
  const key = (raw || '').trim();
  if (!key) return '';
  if (key.includes('@')) return key; // e-mail
  const uuidLike = /^[0-9a-fA-F-]{32,36}$/;
  if (uuidLike.test(key)) return key; // EVP
  return key.replace(/\D/g, ''); // remove tudo que não for dígito
}

type BuildParams = {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount?: string;
  description?: string;
  referenceLabel?: string;
};

function buildPixPayload({
  pixKey,
  merchantName,
  merchantCity,
  amount,
  // description,           // <-- NÃO usar no ID 26 para estático (compatibilidade)
  referenceLabel,
}: BuildParams) {
  const gui = 'BR.GOV.BCB.PIX';

  // ---- Merchant Account Info (ID 26) — somente GUI (00) e Chave (01) ----
  const mai = [
    tlv('00', gui),
    tlv('01', pixKey), // chave Pix registrada (EVP, CNPJ/CPF, e-mail ou telefone)
    // NÃO usar 02 (descrição) em estático para evitar rejeição em alguns bancos
  ].join('');
  const maiTlv = tlv('26', mai);

  // ---- Demais campos ----
  const mcc     = tlv('52', '0000');
  const curr    = tlv('53', '986');
  const amt     = amount ? tlv('54', String(Number(amount)).replace(',', '.')) : ''; // opcional no estático
  const country = tlv('58', 'BR');
  const name    = tlv('59', sanitizeAscii(merchantName.toUpperCase(), 25) || 'RECEBEDOR');
  const city    = tlv('60', sanitizeAscii(merchantCity.toUpperCase(), 15) || 'MINAS GERAIS');

  // Additional Data (62) — use só 05 (Reference Label) para identificação/conciliação
  const addData = tlv('62', referenceLabel ? tlv('05', sanitizeAscii(referenceLabel, 25)) : '');

  // ---- Cabeçalho + “Point of Initiation” ----
  const pfi = tlv('00', '01'); // Payload Format Indicator
  const poi = tlv('01', '12'); // 12 = ESTÁTICO (NÃO dinâmico)

  // ---- Monta payload e calcula CRC ----
  const base = [pfi, poi, maiTlv, mcc, curr, amt, country, name, city, addData, '6304'].join('');
  const crc = crc16(base);
  return base + crc;
}


/* ========= Componente principal ========= */

export type PixQrProps = {
  descriptionAppend?: string;
  referenceLabelOverride?: string;
  merchantCity?: string;
  size?: number;
  className?: string;
  showCopyButtons?: boolean;
};

export default function PixQr({
  descriptionAppend,
  referenceLabelOverride,
  merchantCity = 'MINAS GERAIS',
  size = 256,
  className,
  showCopyButtons = true,
}: PixQrProps) {
  const PIX_KEY = process.env.NEXT_PUBLIC_PIX_KEY || '';
  const PIX_FAV = process.env.NEXT_PUBLIC_PIX_FAVORECIDO || 'ONG Amigos de Minas';
  const PIX_CNPJ = process.env.NEXT_PUBLIC_PIX_CNPJ || '';
  const PIX_OBS = process.env.NEXT_PUBLIC_PIX_OBS || 'Apadrinhamento';

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [payload, setPayload] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedBr, setCopiedBr] = useState(false);

  const descriptionFinal = useMemo(() => {
    const base = PIX_OBS?.trim() || 'Apadrinhamento';
    const extra = descriptionAppend ? ` ${descriptionAppend}` : '';
    return `${base}${extra}`.slice(0, 50);
  }, [PIX_OBS, descriptionAppend]);

  const referenceLabel = useMemo(() => {
    if (referenceLabelOverride)
      return referenceLabelOverride.toUpperCase().slice(0, 25);
    if (descriptionAppend)
      return descriptionAppend.replace(/\s+/g, '-').toUpperCase().slice(0, 25);
    return 'AMIGOSDEM';
  }, [descriptionAppend, referenceLabelOverride]);

  useEffect(() => {
    const key = normalizePixKey(PIX_KEY);
    if (!key || !PIX_FAV) {
      setPayload('');
      setQrDataUrl('');
      return;
    }
    const p = buildPixPayload({
      pixKey: key,
      merchantName: PIX_FAV,
      merchantCity,
      // description: descriptionFinal,   // <-- remova
      referenceLabel,                     // <-- mantenha um identificador curto aqui
    });
    setPayload(p);

    QRCode.toDataURL(p, { margin: 1, width: size })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [PIX_KEY, PIX_FAV, merchantCity, descriptionFinal, referenceLabel, size]);

  return (
    <div className={className}>
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR Code PIX"
              width={size}
              height={size}
              className="rounded-lg border border-emerald-100"
            />
          ) : (
            <div
              style={{ width: size, height: size }}
              className="grid place-items-center rounded-lg border border-emerald-100 text-xs text-gray-500"
            >
              QR indisponível
            </div>
          )}
        </div>

        <div className="text-sm text-gray-700 space-y-2">
          <div><b>Chave PIX:</b> <span className="select-all">{PIX_KEY || '—'}</span></div>
          <div><b>Favorecido:</b> {PIX_FAV}</div>
          {PIX_CNPJ && <div><b>CNPJ:</b> {PIX_CNPJ}</div>}
          {descriptionFinal && <div><b>Observação:</b> {descriptionFinal}</div>}

          {showCopyButtons && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(PIX_KEY);
                  setCopiedKey(true);
                  setTimeout(() => setCopiedKey(false), 2000);
                }}
                disabled={!PIX_KEY}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-70"
              >
                {copiedKey ? 'Chave copiada!' : 'Copiar chave'}
              </button>

              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(payload);
                  setCopiedBr(true);
                  setTimeout(() => setCopiedBr(false), 2000);
                }}
                disabled={!payload}
                className="px-3 py-1.5 bg-[#253243] text-white rounded-md hover:bg-[#375A7F] disabled:opacity-70"
              >
                {copiedBr ? 'Copia e Cola copiado!' : 'Copiar Pix Copia e Cola'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
