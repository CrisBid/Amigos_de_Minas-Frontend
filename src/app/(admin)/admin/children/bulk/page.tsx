'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Upload,
  ClipboardPaste,
  Columns2,
  CheckCircle2,
  AlertTriangle,
  Baby,
  Image as ImageIcon,
  FileImage,
  LayoutTemplate,
  ArrowLeft,
  ArrowRight,
  X,
  MapPin,
  Download,
} from 'lucide-react';

/* =====================
   Tipos
===================== */

type DraftChild = {
  publicId: number | string;
  name: string;
  birthDate?: string | null; // ISO yyyy-mm-dd para enviar ao backend
  cityName?: string | null;
  state?: string | null;
  category?: string | null;
  wantedGift?: string | null;
  description?: string | null;
};

type ColumnMap = {
  publicId?: string;
  name?: string;
  birthDate?: string; // virá como DD/MM/YYYY na pasta, convertemos para ISO
  category?: string;
  wantedGift?: string;
  description?: string;
};

type Option = { id: string; name: string; state?: string | null };

type Step = 1 | 2 | 3 | 4 | 5;

type CampaignFrame = {
  id: string;
  url: string;
  key: string;
  name?: string | null;
  config?: any;
  active?: boolean;
};

/* ===== Novo modelo de composição ===== */

type Gravity =
  | 'north' | 'northeast' | 'east' | 'southeast'
  | 'south' | 'southwest' | 'west' | 'northwest' | 'center';

type PhotoRect = {
  x: number; y: number; width: number; height: number;
  fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  gravity: Gravity;
  cornerRadius: number;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
};

type TextSpec = {
  id: string;
  template: string;
  x: number;
  y: number;
  maxWidth: number;
  align: 'left'|'center'|'right';
  font: { family: string; size: number; weight: number };
  fill: string;
  uppercase?: boolean;
  letterSpacing?: number;
  lineHeight?: number;
};

type ComposeConfig = {
  version: number;
  canvas: { width: number; height: number; background?: null | { r:number; g:number; b:number; alpha:number } };
  layout: { resizeToCanvas: boolean; opacity?: number; onTop?: boolean }; // <— novo onTop
  photoRect: PhotoRect;
  texts: TextSpec[];
};

/* ===== Defaults ===== */

const DEFAULT_CONFIG: ComposeConfig = {
  version: 2,
  canvas: { width: 1080, height: 1350, background: null },
  layout: { resizeToCanvas: true, opacity: 1, onTop: true },
  photoRect: {
    x: 60, y: 200, width: 960, height: 960,
    fit: 'cover', gravity: 'center', cornerRadius: 0,
    scale: 1, offsetX: 0, offsetY: 0
  },
  texts: [
    {
      id: 'name',
      template: '{name}',
      x: 72, y: 140, maxWidth: 936,
      align: 'center',
      font: { family: 'Inter, sans-serif', size: 54, weight: 800 },
      fill: '#0f172a',
      uppercase: true, letterSpacing: 0, lineHeight: 1.1
    },
    {
      id: 'meta',
      template: 'ID {publicId} • {age} • {cityName}',
      x: 72, y: 1180, maxWidth: 936,
      align: 'center',
      font: { family: 'Inter, sans-serif', size: 40, weight: 700 },
      fill: '#111827'
    },
    {
      id: 'gift',
      template: '{wantedGift}',
      x: 72, y: 1240, maxWidth: 936,
      align: 'center',
      font: { family: 'Inter, sans-serif', size: 34, weight: 600 },
      fill: '#374151'
    }
  ]
};

/* =====================
   Componente principal
===================== */

export default function BulkChildrenWizardPage() {
  const [step, setStep] = useState<Step>(1);

  // Step 1: contexto
  const [cities, setCities] = useState<Option[]>([]);
  const [communities, setCommunities] = useState<Option[]>([]);
  const [schools, setSchools] = useState<Option[]>([]);
  const [campaigns, setCampaigns] = useState<Option[]>([]);

  const [cityId, setCityId] = useState<string>('');
  const [communityId, setCommunityId] = useState<string>('');
  const [schoolId, setSchoolId] = useState<string>('');
  const [campaignId, setCampaignId] = useState<string>('');

  const canGoStep2 = !!cityId && !!campaignId;

  // Step 2: colar tabela
  const [rawText, setRawText] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [colMap, setColMap] = useState<ColumnMap>({});
  const [drafts, setDrafts] = useState<DraftChild[]>([]);
  const [localErrors, setLocalErrors] = useState<string[]>([]);

  // Step 3: layouts e config
  const [layoutFile, setLayoutFile] = useState<File | null>(null);
  const [layoutUploadedUrl, setLayoutUploadedUrl] = useState<string | null>(null);
  const [uploadingLayout, setUploadingLayout] = useState(false);

  const [frames, setFrames] = useState<CampaignFrame[]>([]);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);

  // Config de composição (que vai junto no upload da foto)
  const [composeCfg, setComposeCfg] = useState<ComposeConfig>(DEFAULT_CONFIG);

  // Step 4: fotos
  const [files, setFiles] = useState<File[]>([]);
  const [photoMap, setPhotoMap] = useState<Record<string, File | null>>({});
  const [photoIssues, setPhotoIssues] = useState<string[]>([]);

  // Step 5: conferência / previews compostas
  const [composed, setComposed] = useState<Record<string, string>>({}); // pid -> dataURL
  const [composing, setComposing] = useState(false);

  // Commit
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<any>(null);

  /* =====================
     Helpers
  ===================== */

  const normalizeName = (s?: string | null) =>
    (s ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  const parsePastedTable = (text: string) => {
    const lines = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter((l) => l.trim().length > 0);

    if (lines.length === 0) return { headers: [], rows: [] };

    const guessSep = (s: string): string => {
      if (s.includes('\t')) return '\t';
      if ((s.match(/;/g) || []).length >= (s.match(/,/g) || []).length) return ';';
      return ',';
    };

    const sep = guessSep(lines[0]);
    const split = (s: string) => s.split(sep).map((c) => c.trim());

    const hdr = split(lines[0]);
    const data = lines.slice(1).map(split);

    return { headers: hdr, rows: data };
  };

  const tryAutoMap = (hdrs: string[]): ColumnMap => {
    const key = (h: string) => normalizeName(h);
    const find = (alts: string[]) => hdrs.find((h) => alts.includes(key(h)));

    const m: ColumnMap = {};
    m.publicId = find(['id', '#', 'publicid', 'codigo', 'cod', 'numero', 'nº']) ?? hdrs[0];
    m.name = find(['nome', 'name', 'crianca', 'child']);
    m.birthDate = find(['nascimento', 'data de nascimento', 'datanascimento', 'birthdate', 'dn']);
    m.category = find(['categoria', 'category', 'grupo']);
    m.wantedGift = find(['presente', 'presentedesejado', 'wantedgift', 'pedido', 'desejo']);
    m.description = find(['descricao', 'description', 'obs', 'observacao']);
    return m;
  };

  const parseBrazilianDate = (s: string): string | null => {
    const parts = s.split('/');
    if (parts.length !== 3) return null;
    const [ddStr, mmStr, yyyyStr] = parts;
    const dd = parseInt(ddStr, 10);
    const mm = parseInt(mmStr, 10);
    const yyyy = parseInt(yyyyStr, 10);
    if (!dd || !mm || !yyyy) return null;
    const date = new Date(yyyy, mm - 1, dd);
    if (isNaN(date.getTime())) return null;
    if (date.getFullYear() !== yyyy || date.getMonth() + 1 !== mm || date.getDate() !== dd) return null;
    return date.toISOString().split('T')[0];
  };

  const formatBrazilianDate = (iso?: string | null) => {
    if (!iso) return '—';
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso;
    const [_, y, mo, d] = m;
    return `${d}/${mo}/${y}`;
  };

  // aplica cidade/UF
  const applyCity = (items: DraftChild[]): DraftChild[] => {
    const sel = cities.find((c) => c.id === cityId);
    if (!sel) return items;
    return items.map((d) => ({
      ...d,
      cityName: sel.name,
      state: sel.state ?? undefined,
    }));
  };

  /* =====================
     Carregar opções Passo 1
  ===================== */

  useEffect(() => {
    const loadCities = async () => {
      try {
        const url = new URL('/api/admin/cities', window.location.origin);
        url.searchParams.set('page', '1');
        url.searchParams.set('pageSize', '500');
        const res = await fetch(url.toString(), {
          cache: 'no-store',
          credentials: 'include',
          headers: { accept: 'application/json' },
        });
        if (!res.ok) return;
        const js = await res.json();
        setCities(Array.isArray(js?.items) ? js.items : js);
      } catch {}
    };
    const loadCampaigns = async () => {
      try {
        const url = new URL('/api/admin/campaigns', window.location.origin);
        url.searchParams.set('status', 'ACTIVE');
        url.searchParams.set('page', '1');
        url.searchParams.set('pageSize', '200');
        const res = await fetch(url.toString(), {
          cache: 'no-store',
          credentials: 'include',
          headers: { accept: 'application/json' },
        });
        if (!res.ok) return;
        const js = await res.json();
        setCampaigns(Array.isArray(js?.items) ? js.items : js);
      } catch {}
    };
    loadCities();
    loadCampaigns();
  }, []);

  useEffect(() => {
    const loadCommunities = async () => {
      if (!cityId) {
        setCommunities([]);
        setCommunityId('');
        return;
      }
      try {
        const url = new URL('/api/admin/communities', window.location.origin);
        url.searchParams.set('cityId', cityId);
        url.searchParams.set('page', '1');
        url.searchParams.set('pageSize', '500');
        const res = await fetch(url.toString(), {
          cache: 'no-store',
          credentials: 'include',
          headers: { accept: 'application/json' },
        });
        if (!res.ok) return;
        const js = await res.json();
        setCommunities(Array.isArray(js?.items) ? js.items : js);
      } catch {}
    };
    loadCommunities();
  }, [cityId]);

  useEffect(() => {
    const loadSchools = async () => {
      if (!communityId) {
        setSchools([]);
        setSchoolId('');
        return;
      }
      try {
        const url = new URL('/api/admin/schools', window.location.origin);
        url.searchParams.set('communityId', communityId);
        url.searchParams.set('page', '1');
        url.searchParams.set('pageSize', '500');
        const res = await fetch(url.toString(), {
          cache: 'no-store',
          credentials: 'include',
          headers: { accept: 'application/json' },
        });
        if (!res.ok) return;
        const js = await res.json();
        setSchools(Array.isArray(js?.items) ? js.items : js);
      } catch {}
    };
    loadSchools();
  }, [communityId]);

  /* =====================
     Layouts + carregar frames da campanha
  ===================== */

  useEffect(() => {
    const loadFrames = async () => {
      if (!campaignId) {
        setFrames([]);
        setSelectedFrameId(null);
        setLayoutUploadedUrl(null);
        // ao trocar de campanha, resetamos o config para default
        setComposeCfg(DEFAULT_CONFIG);
        return;
      }
      try {
        const res = await fetch(`/api/admin/campaigns/${campaignId}/layouts`, {
          cache: 'no-store',
          credentials: 'include',
          headers: { accept: 'application/json' },
        });
        if (!res.ok) return;
        const list: CampaignFrame[] = await res.json();
        setFrames(list);
        const active = list.find((f) => f.active);
        setSelectedFrameId(active?.id ?? null);
        setLayoutUploadedUrl(active?.url ?? null);

        // se o frame ativo tiver config, mescla no nosso composeCfg
        if (active?.config) {
          setComposeCfg((old) => deepMerge(old, active.config));
        }
      } catch {}
    };
    loadFrames();
  }, [campaignId]);

  /* =====================
     Reações Passo 2 (planilha)
  ===================== */

  useEffect(() => {
    if (!rawText.trim()) {
      setHeaders([]);
      setRows([]);
      setColMap({});
      setDrafts([]);
      setLocalErrors([]);
      return;
    }
    const { headers: hdr, rows: dataRows } = parsePastedTable(rawText);
    setHeaders(hdr);
    setRows(dataRows);
    const auto = tryAutoMap(hdr);
    setColMap((prev) => ({ ...auto, ...prev }));

    const built = buildDrafts(hdr, dataRows, auto);
    setDrafts(applyCity(built.drafts));
    setLocalErrors(built.errors);
  }, [rawText]);

  useEffect(() => {
    if (headers.length === 0) return;
    const built = buildDrafts(headers, rows, colMap);
    setDrafts(applyCity(built.drafts));
    setLocalErrors(built.errors);
  }, [colMap]);

  useEffect(() => {
    setDrafts((prev) => applyCity(prev));
  }, [cityId, cities]);

  /* =====================
     Upload de layout (Passo 3)
  ===================== */

  const doUploadLayout = async () => {
    if (!campaignId || !layoutFile) return;
    setUploadingLayout(true);
    try {
      const fd = new FormData();
      fd.append('file', layoutFile);
      fd.append('name', layoutFile.name);
      fd.append('active', 'true');
      // envia nosso config atual como sugestão para o layout
      fd.append('config', JSON.stringify(composeCfg));

      const res = await fetch(`/api/admin/campaigns/${campaignId}/layouts`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      const r2 = await fetch(`/api/admin/campaigns/${campaignId}/layouts`, { cache: 'no-store', credentials: 'include' });
      const list = await r2.json();
      setFrames(list);
      setSelectedFrameId(created?.id ?? null);
      setLayoutUploadedUrl(created?.url ?? null);
    } catch (e: any) {
      alert(e?.message || 'Erro no upload do layout');
    } finally {
      setUploadingLayout(false);
    }
  };

  const layoutSrc = useMemo(() => {
    const sel = frames.find((f) => f.id === selectedFrameId);
    if (sel?.url) return sel.url;
    if (layoutUploadedUrl) return layoutUploadedUrl;
    if (layoutFile) return URL.createObjectURL(layoutFile);
    return null;
  }, [frames, selectedFrameId, layoutUploadedUrl, layoutFile]);

  /* =====================
     Fotos (Passo 4): auto-match
  ===================== */

  useEffect(() => {
    if (files.length === 0 || drafts.length === 0) {
      setPhotoMap({});
      setPhotoIssues([]);
      return;
    }
    const issues: string[] = [];
    const map: Record<string, File | null> = {};

    const byPublicId = new Map<string, DraftChild>();
    drafts.forEach((d) => byPublicId.set(String(d.publicId).trim(), d));

    const byName = new Map<string, DraftChild>();
    drafts.forEach((d) => byName.set(normalizeName(d.name), d));

    files.forEach((f) => {
      const base = f.name.replace(/\.[^.]+$/, '');
      const m = base.match(/^(\d{1,12})/);
      if (m) {
        const pid = m[1];
        if (byPublicId.has(pid)) {
          map[pid] = f;
          return;
        }
      }
      const nm = normalizeName(base);
      if (byName.has(nm)) {
        map[String(byName.get(nm)!.publicId)] = f;
        return;
      }
      issues.push(`Não consegui associar "${f.name}" automaticamente.`);
    });

    drafts.forEach((d) => {
      const pid = String(d.publicId);
      if (!(pid in map)) map[pid] = null;
    });

    setPhotoMap(map);
    setPhotoIssues(issues);
  }, [files, drafts]);

  const unmatchedCount = useMemo(() => Object.values(photoMap).filter((v) => v === null).length, [photoMap]);
  const canGoStep5 = Object.keys(photoMap).length > 0;

  /* =====================
     Build drafts a partir da tabela (usa data BR)
  ===================== */

  const buildDrafts = (
    hdrs: string[],
    data: string[][],
    map: ColumnMap
  ): { drafts: DraftChild[]; errors: string[] } => {
    const errs: string[] = [];
    const get = (row: string[], key?: string) => {
      if (!key) return undefined;
      const idx = hdrs.indexOf(key);
      if (idx < 0) return undefined;
      return row[idx]?.trim();
    };

    const city = cities.find((c) => c.id === cityId);

    const ds: DraftChild[] = data.map((r, i) => {
      const publicIdRaw = get(r, map.publicId);
      const name = get(r, map.name) ?? '';
      const birthDateRaw = get(r, map.birthDate);
      const birthDate = birthDateRaw ? parseBrazilianDate(birthDateRaw) : undefined;
      const category = get(r, map.category);
      const wantedGift = get(r, map.wantedGift);
      const description = get(r, map.description);

      const d: DraftChild = {
        publicId: publicIdRaw ?? '',
        name,
        birthDate,
        cityName: city?.name || undefined,
        state: city?.state || undefined,
        category: category || undefined,
        wantedGift: wantedGift || undefined,
        description: description || undefined,
      };

      if (!d.publicId || String(d.publicId).trim() === '') {
        errs.push(`Linha ${i + 2}: publicId vazio.`);
      }
      if (!d.name || d.name.length < 2) {
        errs.push(`Linha ${i + 2}: nome ausente/curto.`);
      }
      if (birthDateRaw && !birthDate) {
        errs.push(`Linha ${i + 2}: data de nascimento inválida (${birthDateRaw}).`);
      }

      return d;
    });

    const seen = new Set<string>();
    ds.forEach((d, idx) => {
      const pid = String(d.publicId).trim();
      if (seen.has(pid)) errs.push(`Duplicidade de publicId: "${pid}" (linha ${idx + 2}).`);
      seen.add(pid);
    });

    return { drafts: ds, errors: errs };
  };

  /* =====================
     Composição de imagem client-side (prévias)
     Agora: LAYOUT como base + foto dentro do photoRect
  ===================== */

  // helper: idade simples
  function calcAgeFromISO(iso?: string | null) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(n => parseInt(n,10));
    if (!y || !m || !d) return '';
    const birth = new Date(y, m-1, d);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const mm = now.getMonth() - birth.getMonth();
    if (mm < 0 || (mm === 0 && now.getDate() < birth.getDate())) age--;
    return `${age} anos`;
  }

  const composePreviewBrowser = async (
    childFile: File,
    layoutSrc: string,
    cfg: ComposeConfig,
    sample: { // <<< agora passamos os dados da criança
      name: string;
      publicId: string;
      age: string;
      wantedGift: string;
      cityName: string;
      communityName?: string;
    }
  ) => {
    const loadImg = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    const childSrc = URL.createObjectURL(childFile);
    try {
      const [photoImg, layoutImg] = await Promise.all([loadImg(childSrc), loadImg(layoutSrc)]);

      const W = cfg.canvas?.width ?? layoutImg.width ?? 1080;
      const H = cfg.canvas?.height ?? layoutImg.height ?? 1350;

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0,0,W,H);

      // fundo opcional
      if (cfg.canvas?.background) {
        const bg = cfg.canvas.background;
        ctx.fillStyle = `rgba(${bg.r},${bg.g},${bg.b},${bg.alpha ?? 1})`;
        ctx.fillRect(0,0,W,H);
      }

      // 1) foto dentro de photoRect
      const pr = cfg.photoRect;
      const dw = pr.width, dh = pr.height;
      const sw = photoImg.width, sh = photoImg.height;
      let r = 1;
      switch (pr.fit) {
        case 'contain': r = Math.min(dw / sw, dh / sh); break;
        case 'fill': r = Math.max(dw / sw, dh / sh); break;
        case 'inside': r = Math.min(dw / sw, dh / sh); break;
        case 'outside': r = Math.max(dw / sw, dh / sh); break;
        default: r = Math.max(dw / sw, dh / sh); // cover
      }
      if (typeof pr.scale === 'number' && pr.scale !== 1) r *= pr.scale;
      const nw = Math.round(sw * r);
      const nh = Math.round(sh * r);
      const ox = Math.round((dw - nw) / 2) + (pr.offsetX || 0);
      const oy = Math.round((dh - nh) / 2) + (pr.offsetY || 0);
      const dx = pr.x + ox;
      const dy = pr.y + oy;

      if (pr.cornerRadius && pr.cornerRadius > 0) {
        ctx.save();
        roundRect(ctx, pr.x, pr.y, pr.width, pr.height, pr.cornerRadius);
        ctx.clip();
        ctx.drawImage(photoImg, dx, dy, nw, nh);
        ctx.restore();
      } else {
        ctx.drawImage(photoImg, dx, dy, nw, nh);
      }

      // 2) layout por cima (com opacidade e resize)
      const layoutOpacity = Math.max(0, Math.min(1, cfg.layout?.opacity ?? 1));
      if (layoutOpacity < 1) { ctx.save(); ctx.globalAlpha = layoutOpacity; }
      if (cfg.layout?.resizeToCanvas) ctx.drawImage(layoutImg, 0, 0, W, H);
      else ctx.drawImage(layoutImg, 0, 0);
      if (layoutOpacity < 1) ctx.restore();

      // 3) textos por cima, com substituição + wrap
      const drawWrappedText = (t: TextSpec) => {
        let raw = t.template ?? '';
        raw = raw
          .replace(/\{name\}/g, sample.name ?? '')
          .replace(/\{publicId\}/g, sample.publicId ?? '')
          .replace(/\{age\}/g, sample.age ?? '')
          .replace(/\{wantedGift\}/g, sample.wantedGift ?? '')
          .replace(/\{cityName\}/g, sample.cityName ?? '')
          .replace(/\{communityName\}/g, sample.communityName ?? '');
        if (t.uppercase) raw = raw.toUpperCase();

        ctx.save();
        // letterSpacing manual simples: desenhar char a char quando informado
        const fontSize = t.font?.size ?? 42;
        const lineH = (t.lineHeight ?? 1.1) * fontSize;
        ctx.font = `${t.font?.weight ?? 700} ${fontSize}px ${t.font?.family ?? 'Inter, system-ui, sans-serif'}`;
        ctx.fillStyle = t.fill ?? '#000';
        ctx.textAlign = (t.align as CanvasTextAlign) ?? 'left';
        ctx.textBaseline = 'top';

        const maxW = t.maxWidth ?? W;
        const words = raw.split(/\s+/);
        let line = '';
        let y = t.y;

        const measure = (s: string) => {
          if ((t.letterSpacing ?? 0) === 0) return ctx.measureText(s).width;
          // aproximação: soma width + spacing*(len-1)
          const base = ctx.measureText(s).width;
          const extra = (s.length - 1) * (t.letterSpacing ?? 0);
          return base + extra;
        };

        const drawLine = (s: string) => {
          let x = t.x;
          if (t.align === 'center') x = t.x + maxW / 2;
          if (t.align === 'right') x = t.x + maxW;
          if ((t.letterSpacing ?? 0) === 0) {
            ctx.fillText(s, x, y, maxW);
          } else {
            // desenha com espaçamento de letras
            let cx = x;
            if (t.align === 'center') cx = x - measure(s) / 2;
            if (t.align === 'right') cx = x - measure(s);
            for (let i = 0; i < s.length; i++) {
              const ch = s[i];
              ctx.fillText(ch, cx, y);
              cx += ctx.measureText(ch).width + (t.letterSpacing ?? 0);
            }
          }
        };

        for (const w of words) {
          const test = line ? `${line} ${w}` : w;
          if (measure(test) <= maxW) line = test;
          else {
            if (line) drawLine(line);
            y += lineH;
            line = w;
          }
        }
        if (line) drawLine(line);
        ctx.restore();
      };

      (cfg.texts || []).forEach(drawWrappedText);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      URL.revokeObjectURL(childSrc);
      return dataUrl;
    } catch (e) {
      URL.revokeObjectURL(childSrc);
      throw e;
    }
  };


  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const radius = Math.min(r, Math.min(w, h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  useEffect(() => {
  let cancelled = false;
  (async () => {
    if (!layoutSrc) { setComposed({}); return; }
    setComposing(true);
    const out: Record<string, string> = {};
    const entries = Object.entries(photoMap).filter(([, f]) => !!f) as [string, File][];

    for (const [pid, file] of entries) {
      try {
        const d = drafts.find(x => String(x.publicId) === pid)!;
        const sample = {
          name: d.name ?? '',
          publicId: String(d.publicId ?? ''),
          age: calcAgeFromISO(d.birthDate),
          wantedGift: d.wantedGift ?? '',
          cityName: d.cityName ?? '',
          communityName: '',
        };
        const img = await composePreviewBrowser(file, layoutSrc, composeCfg, sample);
        if (!cancelled) out[pid] = img;
      } catch {}
    }
    if (!cancelled) setComposed(out);
    setComposing(false);
  })();
  return () => { cancelled = true; };
}, [photoMap, layoutSrc, composeCfg, drafts]);


  /* =====================
     Commit (via rotas Next)
  ===================== */

  const doCommit = async () => {
    setCommitting(true);
    setCommitResult(null);
    try {
      const childrenForApi = drafts.map(({ cityName, state, ...rest }) => rest);
      const res = await fetch('/api/admin/children/bulk/commit', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          children: childrenForApi,
          context: { cityId, communityId: communityId || null, schoolId: schoolId || null, campaignId },
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Falha ao salvar crianças. ${txt}`);
      }
      const result = await res.json().catch(() => ({}));
      setCommitResult(result);

      // Upload das fotos por publicId (com Config)
      const uploadOne = async (pid: string, file: File) => {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('Config', JSON.stringify(composeCfg)); // ESSENCIAL: salva em ChildImage.Config

        const qs = new URLSearchParams();
        qs.set('campaignId', campaignId);
        if (selectedFrameId) qs.set('layoutId', selectedFrameId);

        const r = await fetch(`/api/admin/children/${encodeURIComponent(pid)}/photo?${qs.toString()}`, {
          method: 'POST',
          body: fd,
          credentials: 'include',
          cache: 'no-store',
        });
        if (!r.ok) {
          const t = await r.text().catch(() => '');
          throw new Error(`Foto de ${pid} falhou: ${t}`);
        }
      };

      for (const [pid, file] of Object.entries(photoMap)) {
        if (file) await uploadOne(pid, file);
      }

      alert('Cadastro em lote concluído com sucesso!');
    } catch (e: any) {
      alert(e?.message || 'Erro ao concluir o cadastro');
    } finally {
      setCommitting(false);
    }
  };

  /* =====================
     UI
  ===================== */

  const StepIndicator = () => (
    <div className="flex items-center gap-3 mb-6">
      {[
        { n: 1, label: 'Contexto' },
        { n: 2, label: 'Colar tabela' },
        { n: 3, label: 'Layout & Config' },
        { n: 4, label: 'Fotos' },
        { n: 5, label: 'Conferência' },
      ].map((s) => (
        <div key={s.n} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${
              step >= (s.n as Step) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-300'
            }`}
          >
            {s.n}
          </div>
          <span className={`text-sm ${step >= (s.n as Step) ? 'text-gray-900' : 'text-gray-500'}`}>{s.label}</span>
          {s.n !== 5 && <div className="w-10 border-t border-gray-300 mx-2" />}
        </div>
      ))}
    </div>
  );

  const [showEditor, setShowEditor] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Baby className="w-6 h-6 text-blue-600" /> Cadastro Guiado de Crianças
          </h1>
        </div>

        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
          <StepIndicator />

          {/* STEP 1: CONTEXTO */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-200 p-4 bg-white">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" /> Defina o contexto
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cidade *</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={cityId}
                      onChange={(e) => {
                        setCityId(e.target.value);
                        setCommunityId('');
                        setSchoolId('');
                      }}
                    >
                      <option value="">Selecione…</option>
                      {cities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.state ? `/${c.state}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Comunidade (opcional)</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={communityId}
                      onChange={(e) => {
                        setCommunityId(e.target.value);
                        setSchoolId('');
                      }}
                      disabled={!cityId}
                    >
                      <option value="">—</option>
                      {communities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Escola (opcional)</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={schoolId}
                      onChange={(e) => setSchoolId(e.target.value)}
                      disabled={!communityId}
                    >
                      <option value="">—</option>
                      {schools.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Campanha *</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={campaignId}
                      onChange={(e) => setCampaignId(e.target.value)}
                    >
                      <option value="">Selecione…</option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Somente campanhas ativas são listadas.</p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end">
                  <button
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                    disabled={!canGoStep2}
                    onClick={() => setStep(2)}
                  >
                    Próximo <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: COLAR */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-200 p-4 bg-white">
                <label className="block text-sm font-medium text-gray-700 mb-2">Cole aqui a tabela copiada do Excel/Sheets</label>
                <textarea
                  className="w-full min-h-[160px] rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 p-3"
                  placeholder="Cole (Ctrl+V) os dados aqui. A primeira linha deve conter os cabeçalhos."
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-2">
                  <ClipboardPaste className="w-4 h-4" /> Dica: TAB (TSV) do Excel/Sheets é reconhecido automaticamente. Datas devem estar no formato DD/MM/AAAA.
                </p>
              </div>

              {headers.length > 0 && (
                <div className="rounded-xl border border-gray-200 p-4 bg-white">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Columns2 className="w-5 h-5 text-blue-600" /> Mapeie as colunas
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {([
                      { key: 'publicId', label: 'Public ID (obrigatório)' },
                      { key: 'name', label: 'Nome (obrigatório)' },
                      { key: 'birthDate', label: 'Data de nascimento (DD/MM/AAAA)' },
                      { key: 'category', label: 'Categoria' },
                      { key: 'wantedGift', label: 'Presente desejado' },
                      { key: 'description', label: 'Descrição/Obs' },
                    ] as const).map((f) => (
                      <div key={f.key} className="flex items-center gap-3">
                        <label className="w-56 text-sm text-gray-700">{f.label}</label>
                        <select
                          className="flex-1 rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={(colMap as any)[f.key] ?? ''}
                          onChange={(e) => setColMap((m) => ({ ...m, [f.key]: e.target.value || undefined }))}
                        >
                          <option value="">— (ignorar)</option>
                          {headers.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  <div className="text-xs text-gray-500 mb-2">
                    Cidade e UF não são lidas da tabela: serão aplicadas automaticamente conforme a Cidade escolhida no passo 1.
                  </div>
                  <div className="mt-2 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          {headers.map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-gray-700">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rows.slice(0, 10).map((r, i) => (
                          <tr key={i}>
                            {r.map((c, j) => (
                              <td key={j} className="px-3 py-2 text-gray-700">{c}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rows.length > 10 && <p className="text-xs text-gray-500 mt-2">Mostrando 10 de {rows.length} linhas para pré-visualização.</p>}
                  </div>

                  {localErrors.length > 0 ? (
                    <div className="mt-4 p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800">
                      <div className="flex items-center gap-2 font-semibold">
                        <AlertTriangle className="w-4 h-4" /> Problemas encontrados
                      </div>
                      <ul className="mt-2 list-disc ml-5 text-xs">{localErrors.slice(0, 8).map((e, idx) => <li key={idx}>{e}</li>)}</ul>
                      {localErrors.length > 8 && <p className="text-xs mt-1">…e mais {localErrors.length - 8}.</p>}
                    </div>
                  ) : (
                    drafts.length > 0 && (
                      <div className="mt-4 p-3 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> {drafts.length} linhas válidas para importação.
                      </div>
                    )
                  )}

                  <div className="mt-6 flex items-center justify-between">
                    <button
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
                      onClick={() => setStep(1)}
                    >
                      <ArrowLeft className="w-4 h-4" /> Voltar
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
                        onClick={() => setRawText('')}
                      >
                        <X className="w-4 h-4" /> Limpar
                      </button>
                      <button
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                        disabled={!(drafts.length > 0 && localErrors.length === 0 && colMap.publicId && colMap.name)}
                        onClick={() => setStep(3)}
                      >
                        Próximo <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: LAYOUT + CONFIG */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-200 p-4 bg-white">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <LayoutTemplate className="w-5 h-5 text-blue-600" /> Layout da campanha
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Campanha</label>
                    <input
                      className="w-full rounded-lg border border-gray-200 p-2 bg-gray-50"
                      value={campaigns.find((c) => c.id === campaignId)?.name || campaignId}
                      readOnly
                    />
                    <p className="text-xs text-gray-500 mt-1">Definida no passo 1.</p>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Arquivo do layout</label>
                      <input type="file" accept="image/*" onChange={(e) => setLayoutFile(e.target.files?.[0] || null)} />
                      <div className="mt-3 flex items-center gap-3">
                        <button
                          disabled={!campaignId || !layoutFile || uploadingLayout}
                          onClick={doUploadLayout}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                        >
                          <Upload className="w-4 h-4" /> {uploadingLayout ? 'Enviando…' : 'Enviar layout'}
                        </button>
                        {layoutUploadedUrl && <span className="text-sm text-emerald-700">Enviado ✓ {layoutUploadedUrl}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Configuração da composição (padrão para as fotos)</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                      <div>
                        <label className="block text-xs text-gray-600">Canvas Largura</label>
                        <input type="number" className="w-full border rounded px-2 py-1"
                          value={composeCfg.canvas.width}
                          onChange={(e)=> setComposeCfg(c => ({...c, canvas: {...c.canvas, width: parseInt(e.target.value||'1080',10)||1080}}))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600">Canvas Altura</label>
                        <input type="number" className="w-full border rounded px-2 py-1"
                          value={composeCfg.canvas.height}
                          onChange={(e)=> setComposeCfg(c => ({...c, canvas: {...c.canvas, height: parseInt(e.target.value||'1350',10)||1350}}))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600">Layout - Canvas</label>
                        <select className="w-full border rounded px-2 py-1"
                          value={composeCfg.layout.resizeToCanvas ? '1' : '0'}
                          onChange={(e)=> setComposeCfg(c => ({...c, layout: {...c.layout, resizeToCanvas: e.target.value==='1'}}))}
                        >
                          <option value="1">Esticar</option>
                          <option value="0">Tamanho original</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600">Opacidade Layout</label>
                        <input type="number" min={0} max={1} step={0.05} className="w-full border rounded px-2 py-1"
                          value={composeCfg.layout.opacity ?? 1}
                          onChange={(e)=> setComposeCfg(c => ({...c, layout: {...c.layout, opacity: Math.max(0, Math.min(1, parseFloat(e.target.value)||1))}}))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600">PhotoRect X</label>
                        <input type="number" className="w-full border rounded px-2 py-1"
                          value={composeCfg.photoRect.x}
                          onChange={(e)=> setComposeCfg(c => ({...c, photoRect: {...c.photoRect, x: parseInt(e.target.value||'0',10)||0}}))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600">PhotoRect Y</label>
                        <input type="number" className="w-full border rounded px-2 py-1"
                          value={composeCfg.photoRect.y}
                          onChange={(e)=> setComposeCfg(c => ({...c, photoRect: {...c.photoRect, y: parseInt(e.target.value||'0',10)||0}}))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600">PhotoRect W</label>
                        <input type="number" className="w-full border rounded px-2 py-1"
                          value={composeCfg.photoRect.width}
                          onChange={(e)=> setComposeCfg(c => ({...c, photoRect: {...c.photoRect, width: parseInt(e.target.value||'1080',10)||1080}}))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600">PhotoRect H</label>
                        <input type="number" className="w-full border rounded px-2 py-1"
                          value={composeCfg.photoRect.height}
                          onChange={(e)=> setComposeCfg(c => ({...c, photoRect: {...c.photoRect, height: parseInt(e.target.value||'1350',10)||1350}}))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600">Corner Radius</label>
                        <input type="number" className="w-full border rounded px-2 py-1"
                          value={composeCfg.photoRect.cornerRadius}
                          onChange={(e)=> setComposeCfg(c => ({...c, photoRect: {...c.photoRect, cornerRadius: parseInt(e.target.value||'0',10)||0}}))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600">Fit</label>
                        <select className="w-full border rounded px-2 py-1"
                          value={composeCfg.photoRect.fit}
                          onChange={(e)=> setComposeCfg(c => ({...c, photoRect: {...c.photoRect, fit: e.target.value as any}}))}
                        >
                          <option value="cover">cover</option>
                          <option value="contain">contain</option>
                          <option value="fill">fill</option>
                          <option value="inside">inside</option>
                          <option value="outside">outside</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600">Gravity</label>
                        <select className="w-full border rounded px-2 py-1"
                          value={composeCfg.photoRect.gravity}
                          onChange={(e)=> setComposeCfg(c => ({...c, photoRect: {...c.photoRect, gravity: e.target.value as Gravity}}))}
                        >
                          {['north','northeast','east','southeast','south','southwest','west','northwest','center'].map(g=>(
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600">Scale</label>
                        <input type="number" step={0.05} className="w-full border rounded px-2 py-1"
                          value={composeCfg.photoRect.scale ?? 1}
                          onChange={(e)=> setComposeCfg(c => ({...c, photoRect: {...c.photoRect, scale: parseFloat(e.target.value)||1}}))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600">Offset X</label>
                        <input type="number" className="w-full border rounded px-2 py-1"
                          value={composeCfg.photoRect.offsetX ?? 0}
                          onChange={(e)=> setComposeCfg(c => ({...c, photoRect: {...c.photoRect, offsetX: parseInt(e.target.value||'0',10)||0}}))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600">Offset Y</label>
                        <input type="number" className="w-full border rounded px-2 py-1"
                          value={composeCfg.photoRect.offsetY ?? 0}
                          onChange={(e)=> setComposeCfg(c => ({...c, photoRect: {...c.photoRect, offsetY: parseInt(e.target.value||'0',10)||0}}))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {frames.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Layouts desta campanha</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {frames.map((f) => (
                      <div key={f.id} className={`border rounded-xl p-3 bg-white ${selectedFrameId === f.id ? 'ring-2 ring-blue-500' : ''}`}>
                        <div className="aspect-[4/5] bg-gray-100 rounded-lg overflow-hidden mb-2">
                          <img src={f.url} alt={f.name || 'Layout'} className="w-full h-full object-contain" />
                        </div>
                        <div className="flex items-center justify-between">
                          <input
                            className="text-sm font-medium flex-1 mr-2 border border-gray-200 rounded px-2 py-1"
                            defaultValue={f.name || ''}
                            onBlur={async (e) => {
                              const name = e.target.value.trim();
                              await fetch(`/api/admin/campaign-frames/${f.id}`, {
                                method: 'PATCH',
                                headers: { 'content-type': 'application/json' },
                                body: JSON.stringify({ name }),
                              });
                            }}
                          />
                          {f.active ? (
                            <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700">Ativo</span>
                          ) : (
                            <button
                              className="text-xs px-2 py-1 rounded bg-blue-600 text-white"
                              onClick={async () => {
                                await fetch(`/api/admin/campaign-frames/${f.id}/set-active`, { method: 'POST' });
                                const r = await fetch(`/api/admin/campaigns/${campaignId}/layouts`, { cache: 'no-store' });
                                const list = await r.json();
                                setFrames(list);
                                setSelectedFrameId(f.id);
                              }}
                            >
                              Tornar ativo
                            </button>
                          )}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <button
                            className="text-xs px-2 py-1 rounded border border-gray-300"
                            onClick={() => {
                              setSelectedFrameId(f.id);
                              if (f.config) setComposeCfg(c => deepMerge(c, f.config));
                            }}
                          >
                            Usar nas prévias
                          </button>
                          <button
                            className="text-xs px-2 py-1 rounded border border-red-300 text-red-700"
                            onClick={async () => {
                              if (!confirm('Excluir este layout?')) return;
                              await fetch(`/api/admin/campaign-frames/${f.id}`, { method: 'DELETE' });
                              const r = await fetch(`/api/admin/campaigns/${campaignId}/layouts`, { cache: 'no-store' });
                              const list = await r.json();
                              setFrames(list);
                              if (selectedFrameId === f.id) setSelectedFrameId(null);
                            }}
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end">
                <button
                  disabled={!layoutSrc}
                  onClick={() => setShowEditor(true)}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-50"
                >
                  Personalizar texto e posicionamento
                </button>
              </div>
              <div className="flex items-center justify-between">
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
                  onClick={() => setStep(2)}
                >
                  <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => setStep(4)}
                >
                  Próximo <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: FOTOS */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-200 p-4 bg-white">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileImage className="w-5 h-5 text-blue-600" /> Upload das fotos
                </h3>
                <div className="flex items-center gap-3">
                  <input type="file" multiple accept="image/*" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
                  <p className="text-xs text-gray-500">
                    Dica: nomeie os arquivos como <strong>123_foto.jpg</strong> (onde 123 é o <em>publicId</em>) ou exatamente o nome da criança.
                  </p>
                </div>

                {Object.keys(photoMap).length > 0 && (
                  <div className="mt-6 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 py-2 text-left">publicId</th>
                          <th className="px-3 py-2 text-left">Nome</th>
                          <th className="px-3 py-2 text-left">Foto associada</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {drafts.slice(0, 50).map((d) => {
                          const pid = String(d.publicId);
                          const file = photoMap[pid] || null;
                          return (
                            <tr key={pid}>
                              <td className="px-3 py-2">{pid}</td>
                              <td className="px-3 py-2">{d.name}</td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <ImageIcon className={`w-4 h-4 ${file ? 'text-emerald-600' : 'text-gray-400'}`} />
                                  <span className="text-gray-700">{file ? file.name : '— sem foto'}</span>
                                  <select
                                    className="ml-3 rounded border border-gray-300 p-1"
                                    value={file ? file.name : ''}
                                    onChange={(e) => {
                                      const fname = e.target.value;
                                      setPhotoMap((m) => ({
                                        ...m,
                                        [pid]: fname ? files.find((f) => f.name === fname) || null : null,
                                      }));
                                    }}
                                  >
                                    <option value="">(sem foto)</option>
                                    {files.map((f) => (
                                      <option key={f.name} value={f.name}>{f.name}</option>
                                    ))}
                                  </select>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {drafts.length > 50 && <p className="text-xs text-gray-500 mt-2">Mostrando 50 de {drafts.length} crianças para pré-visualização.</p>}
                  </div>
                )}

                {(photoIssues.length > 0 || unmatchedCount > 0) && (
                  <div className="mt-4 p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertTriangle className="w-4 h-4" /> Atenção
                    </div>
                    {photoIssues.length > 0 && (
                      <ul className="mt-2 list-disc ml-5 text-xs">{photoIssues.slice(0, 6).map((e, idx) => <li key={idx}>{e}</li>)}</ul>
                    )}
                    {unmatchedCount > 0 && <p className="text-xs mt-2">Crianças sem foto associada: {unmatchedCount}.</p>}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
                  onClick={() => setStep(3)}
                >
                  <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                  disabled={!canGoStep5}
                  onClick={() => setStep(5)}
                >
                  Próximo <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: CONFERÊNCIA */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-200 p-4 bg-white">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" /> Conferência final
                </h3>

                {!layoutSrc && (
                  <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 mb-4">
                    Para ver a prévia composta, selecione/enviar um layout (Passo 3).
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {drafts.map((d) => {
                    const pid = String(d.publicId);
                    const img = composed[pid];
                    const file = photoMap[pid] || null;
                    return (
                      <div key={pid} className="rounded-2xl border border-gray-200 overflow-hidden bg-white shadow-sm">
                        <div className="aspect-[4/5] w-full bg-gray-100 flex items-center justify-center">
                          {layoutSrc && file && img ? (
                            <img src={img} alt={`Prévia ${d.name}`} className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-xs text-gray-500 p-4 text-center">{file ? 'Gerando prévia…' : 'Sem foto associada'}</div>
                          )}
                        </div>
                        <div className="p-4 space-y-1">
                          <div className="text-sm font-semibold text-gray-900 truncate">{d.name}</div>
                          <div className="text-xs text-gray-500">ID: {pid}</div>
                          <div className="text-xs text-gray-500">Nasc.: {formatBrazilianDate(d.birthDate)}</div>
                          {d.category && <div className="text-xs text-gray-500">Categoria: {d.category}</div>}
                          {d.wantedGift && <div className="text-xs text-gray-500">Desejo: {d.wantedGift}</div>}
                          <div className="text-xs text-gray-500">
                            Cidade/UF: {d.cityName || '—'}{d.state ? `/${d.state}` : ''}
                          </div>

                          {img && (
                            <button
                              onClick={() => downloadDataUrl(img, `preview_${pid}.jpg`)}
                              className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs"
                            >
                              <Download className="w-4 h-4" /> Baixar prévia
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <StatSmall label="Crianças" value={drafts.length} />
                  <StatSmall label="Com foto" value={Object.values(photoMap).filter(Boolean).length} />
                  <StatSmall label="Sem foto" value={Object.values(photoMap).filter((v) => v === null).length} />
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <button
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
                    onClick={() => setStep(4)}
                  >
                    <ArrowLeft className="w-4 h-4" /> Voltar
                  </button>
                  <button
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                    disabled={committing || localErrors.length > 0}
                    onClick={doCommit}
                  >
                    {committing ? 'Confirmando…' : 'Confirmar e cadastrar'}
                  </button>
                </div>

                {commitResult && (
                  <div className="mt-6 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-emerald-800">
                    Importação concluída. {commitResult?.created?.length || 0} criadas, {commitResult?.updated?.length || 0} atualizadas.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {showEditor && layoutSrc && (
        <LayoutComposerModal
          layoutUrl={layoutSrc}
          value={composeCfg}
          onChange={setComposeCfg}
          onClose={() => setShowEditor(false)}
        />
      )}
      </div>
    </div>
  );
}

/* =====================
   Utils UI
===================== */

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function LayoutComposerModal({
  layoutUrl, value, onChange, onClose,
}: {
  layoutUrl: string;
  value: ComposeConfig;
  onChange: (v: ComposeConfig) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<ComposeConfig>(value);
  const W = local.canvas?.width ?? 1080;
  const H = local.canvas?.height ?? 1350;
  const pr = local.photoRect;

  const update = (patch: Partial<ComposeConfig>) =>
    setLocal(prev => ({ ...prev, ...patch }));

  const updatePhoto = (p: Partial<PhotoRect>) =>
    setLocal(prev => ({ ...prev, photoRect: { ...prev.photoRect, ...p } }));

  const updateText = (id: string, p: Partial<TextSpec>) =>
    setLocal(prev => ({
      ...prev,
      texts: prev.texts.map(t => (t.id === id ? { ...t, ...p } : t)),
    }));

  const addText = () => {
    setLocal(prev => ({
      ...prev,
      texts: [
        ...prev.texts,
        {
          id: 't' + Math.random().toString(36).slice(2, 7),
          template: '{name}',
          x: 48,
          y: 48,
          maxWidth: 600,
          align: 'left',
          font: { family: 'Inter, system-ui, sans-serif', size: 36, weight: 700 },
          fill: '#ffffff',
          letterSpacing: 0,
          lineHeight: 1.1,
        },
      ],
    }));
  };

  const removeText = (id: string) =>
    setLocal(prev => ({ ...prev, texts: prev.texts.filter(t => t.id !== id) }));

  // ======== SCALE (zoom automático) ========
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const recompute = () => {
      const pad = 16;
      const availW = el.clientWidth - pad;
      const availH = el.clientHeight - pad;
      const s = Math.min(availW / W, availH / H, 1);
      setScale(isFinite(s) && s > 0 ? s : 1);
    };

    recompute();

    let ro: ResizeObserver | null = null;
    if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
      ro = new ResizeObserver(() => recompute());
      ro.observe(el);
    }

    window.addEventListener('resize', recompute);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', recompute);
    };
  }, [W, H]);

  // ======== Drag e Resize compensando o scale ========
  const startDrag = (e: React.MouseEvent, kind: 'photo' | 'text', id?: string) => {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    const base =
      kind === 'photo'
        ? { x: pr.x, y: pr.y }
        : (() => {
            const t = local.texts.find(t => t.id === id)!;
            return { x: t.x, y: t.y };
          })();

    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - sx) / scale;
      const dy = (ev.clientY - sy) / scale;

      if (kind === 'photo') {
        updatePhoto({
          x: Math.max(0, Math.min(W - pr.width, base.x + dx)),
          y: Math.max(0, Math.min(H - pr.height, base.y + dy)),
        });
      } else if (id) {
        updateText(id, {
          x: Math.max(0, Math.min(W, base.x + dx)),
          y: Math.max(0, Math.min(H, base.y + dy)),
        });
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startResizePhoto = (e: React.MouseEvent) => {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    const base = { w: pr.width, h: pr.height };
    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - sx) / scale;
      const dy = (ev.clientY - sy) / scale;
      updatePhoto({
        width: Math.max(50, Math.min(W - pr.x, base.w + dx)),
        height: Math.max(50, Math.min(H - pr.y, base.h + dy)),
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startResizeText = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const sx = e.clientX;
    const t0 = local.texts.find(t => t.id === id)!;
    const baseW = t0.maxWidth;
    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - sx) / scale;
      updateText(id, { maxWidth: Math.max(60, Math.min(W - t0.x, baseW + dx)) });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-lg">Editor de Composição</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onChange(local);
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white"
            >
              Salvar
            </button>
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg border">
              Fechar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3">
          {/* CANVAS */}
          <div className="lg:col-span-2 p-4">
            <div
              ref={hostRef}
              className="relative mx-auto border rounded-xl bg-gray-100"
              style={{ maxHeight: '75vh', overflow: 'auto', padding: 8 }}
            >
              <div
                className="relative mx-auto overflow-hidden rounded-xl shadow"
                style={{ width: W * scale, height: H * scale }}
              >
                <div
                  className="absolute top-0 left-0"
                  style={{
                    width: W,
                    height: H,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    backgroundImage: `url(${layoutUrl})`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    backgroundSize: local.layout?.resizeToCanvas ? '100% 100%' : 'contain',
                    opacity: local.layout?.opacity ?? 1,
                  }}
                >
                  {/* PHOTO RECT */}
                  <div
                    className="absolute border-2 border-blue-500/80 bg-blue-300/10 cursor-move"
                    style={{ left: pr.x, top: pr.y, width: pr.width, height: pr.height }}
                    onMouseDown={(e) => startDrag(e, 'photo')}
                    title="Área da foto"
                  >
                    <div
                      className="absolute w-3 h-3 bg-blue-600 right-[-6px] bottom-[-6px] cursor-se-resize"
                      onMouseDown={startResizePhoto}
                    />
                  </div>

                  {/* TEXTOS (caixas guia) */}
                  {local.texts.map(t => (
                    <div
                      key={t.id}
                      className="absolute border border-emerald-500/80 bg-emerald-200/10 cursor-move"
                      style={{ left: t.x, top: t.y, width: t.maxWidth }}
                      onMouseDown={(e) => startDrag(e, 'text', t.id)}
                      title="Texto"
                    >
                      <div className="px-1 text-[10px] text-emerald-700/80">#{t.id}</div>
                      <div
                        className="absolute w-3 h-3 bg-emerald-600 right-[-6px] bottom-[-6px] cursor-e-resize"
                        onMouseDown={(e) => startResizeText(e, t.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* PAINEL DE PROPRIEDADES */}
          <div className="p-4 border-l bg-gray-50 space-y-6 max-h-[80vh] overflow-auto">
            {/* Canvas / Layout */}
            <div className="space-y-2">
              <div className="font-semibold">Canvas / Layout</div>
              <div className="grid grid-cols-2 gap-2">
                <NumberInput
                  label="Largura"
                  value={W}
                  onChange={(v) => update({ canvas: { ...local.canvas, width: v } })}
                />
                <NumberInput
                  label="Altura"
                  value={H}
                  onChange={(v) => update({ canvas: { ...local.canvas, height: v } })}
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!local.layout?.resizeToCanvas}
                  onChange={(e) =>
                    update({ layout: { ...local.layout, resizeToCanvas: e.target.checked } })
                  }
                />
                Redimensionar layout para o canvas
              </label>
              <label className="text-sm block">
                Opacidade do layout
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={local.layout?.opacity ?? 1}
                  onChange={(e) =>
                    update({ layout: { ...local.layout, opacity: parseFloat(e.target.value) } })
                  }
                />
              </label>
            </div>

            {/* Foto (photoRect) */}
            <div className="space-y-2">
              <div className="font-semibold">Foto (photoRect)</div>
              <div className="grid grid-cols-2 gap-2">
                <NumberInput label="X" value={pr.x} onChange={(v) => updatePhoto({ x: v })} />
                <NumberInput label="Y" value={pr.y} onChange={(v) => updatePhoto({ y: v })} />
                <NumberInput
                  label="Largura"
                  value={pr.width}
                  onChange={(v) => updatePhoto({ width: v })}
                />
                <NumberInput
                  label="Altura"
                  value={pr.height}
                  onChange={(v) => updatePhoto({ height: v })}
                />
                <NumberInput
                  label="Scale"
                  step={0.05}
                  value={pr.scale ?? 1}
                  onChange={(v) => updatePhoto({ scale: v })}
                />
                <NumberInput
                  label="Cantos"
                  value={pr.cornerRadius ?? 0}
                  onChange={(v) => updatePhoto({ cornerRadius: v })}
                />
                <NumberInput
                  label="offX"
                  value={pr.offsetX ?? 0}
                  onChange={(v) => updatePhoto({ offsetX: v })}
                />
                <NumberInput
                  label="offY"
                  value={pr.offsetY ?? 0}
                  onChange={(v) => updatePhoto({ offsetY: v })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">
                  Fit
                  <select
                    className="w-full border rounded px-2 py-1 text-sm"
                    value={pr.fit}
                    onChange={(e) => updatePhoto({ fit: e.target.value as PhotoRect['fit'] })}
                  >
                    {['cover', 'contain', 'fill', 'inside', 'outside'].map(x => (
                      <option key={x} value={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  Gravity
                  <select
                    className="w-full border rounded px-2 py-1 text-sm"
                    value={pr.gravity}
                    onChange={(e) => updatePhoto({ gravity: e.target.value as Gravity })}
                  >
                    {[
                      'north','northeast','east','southeast','south',
                      'southwest','west','northwest','center',
                    ].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {/* Textos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Textos</div>
                <button onClick={addText} className="text-sm px-2 py-1 rounded bg-emerald-600 text-white">
                  Adicionar texto
                </button>
              </div>

              {local.texts.map(t => (
                <div key={t.id} className="p-2 rounded border bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">#{t.id}</div>
                    <button onClick={() => removeText(t.id)} className="text-xs text-red-600">
                      Remover
                    </button>
                  </div>

                  <label className="text-xs block">
                    Template
                    <input
                      className="w-full border rounded px-2 py-1 text-sm"
                      value={t.template}
                      onChange={(e) => updateText(t.id, { template: e.target.value })}
                    />
                    <span className="text-[11px] text-gray-500">
                      Use {'{name} {publicId} {age} {wantedGift} {cityName} {communityName}'}
                    </span>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <NumberInput label="X" value={t.x} onChange={(v) => updateText(t.id, { x: v })} />
                    <NumberInput label="Y" value={t.y} onChange={(v) => updateText(t.id, { y: v })} />
                    <NumberInput label="Largura máx." value={t.maxWidth} onChange={(v) => updateText(t.id, { maxWidth: v })} />
                  </div>

                  {/* tamanho/peso/cor/alinhamento */}
                  <div className="grid grid-cols-2 gap-2">
                    <NumberInput label="Tamanho da Fonte" value={t.font.size} onChange={(v) => updateText(t.id, { font: { ...t.font, size: v } })} />
                    <NumberInput label="Peso (font-weight)" value={t.font.weight} onChange={(v) => updateText(t.id, { font: { ...t.font, weight: v } })} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs">
                      Alinhamento
                      <select
                        className="w-full border rounded px-2 py-1 text-sm"
                        value={t.align}
                        onChange={(e) => updateText(t.id, { align: e.target.value as TextSpec['align'] })}
                      >
                        <option value="left">Esquerda</option>
                        <option value="center">Centro</option>
                        <option value="right">Direita</option>
                      </select>
                    </label>
                    <label className="text-xs">
                      Cor
                      <input
                        type="color"
                        className="w-full h-9 border rounded"
                        value={t.fill}
                        onChange={(e) => updateText(t.id, { fill: e.target.value })}
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={!!t.uppercase}
                        onChange={(e) => updateText(t.id, { uppercase: e.target.checked })}
                      />
                      MAIÚSCULAS
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs">
                      Espaçamento letras
                      <input
                        type="number"
                        className="w-20 border rounded px-2 py-0.5 text-sm"
                        value={t.letterSpacing ?? 0}
                        onChange={(e) => updateText(t.id, { letterSpacing: Number(e.target.value) })}
                      />
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs">
                      LineHeight
                      <input
                        type="number"
                        step="0.1"
                        className="w-20 border rounded px-2 py-0.5 text-sm"
                        value={t.lineHeight ?? 1.1}
                        onChange={(e) => updateText(t.id, { lineHeight: Number(e.target.value) })}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t">
              <button onClick={() => onChange(local)} className="px-3 py-1.5 rounded-lg border">
                Aplicar no preview
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function NumberInput({ label, value, onChange, step=1 }:{
  label:string; value:number; onChange:(v:number)=>void; step?:number;
}) {
  return (
    <label className="text-sm text-gray-600 block">
      {label}
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={e=>onChange(parseFloat(e.target.value))}
        className="w-full border rounded px-2 py-1"
      />
    </label>
  );
}


function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 bg-white">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="text-lg font-semibold text-gray-900 mt-1 truncate">{value}</div>
    </div>
  );
}

function StatSmall({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 bg-white">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
    </div>
  );
}

/* =====================
   Helpers gerais
===================== */

function deepMerge<T>(a: T, b: any): T {
  const isObj = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(a)) return (b ?? a) as T;
  if (!isObj(b)) return a;
  const out: any = Array.isArray(a) ? [...(a as any)] : { ...(a as any) };
  for (const k of Object.keys(b)) {
    const av = (a as any)[k], bv = b[k];
    if (Array.isArray(bv)) out[k] = bv;
    else if (isObj(bv)) out[k] = deepMerge(av ?? {}, bv);
    else out[k] = bv;
  }
  return out;
}
