"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
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
} from "lucide-react";
import { apiFetch, apiPath } from "@/lib/api";

// =====================
// Tipos
// =====================

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

// =====================
// Componente principal
// =====================

export default function BulkChildrenWizardPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken ?? null;

  const [step, setStep] = useState<Step>(1);

  // Step 1: contexto
  const [cities, setCities] = useState<Option[]>([]);
  const [communities, setCommunities] = useState<Option[]>([]);
  const [schools, setSchools] = useState<Option[]>([]);
  const [campaigns, setCampaigns] = useState<Option[]>([]);

  const [cityId, setCityId] = useState<string>("");
  const [communityId, setCommunityId] = useState<string>("");
  const [schoolId, setSchoolId] = useState<string>("");
  const [campaignId, setCampaignId] = useState<string>("");

  const canGoStep2 = !!cityId && !!campaignId;

  // Step 2: colar tabela
  const [rawText, setRawText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [colMap, setColMap] = useState<ColumnMap>({});
  const [drafts, setDrafts] = useState<DraftChild[]>([]);
  const [localErrors, setLocalErrors] = useState<string[]>([]);

  // Step 3: layout
  const [layoutFile, setLayoutFile] = useState<File | null>(null);
  const [layoutUploadedUrl, setLayoutUploadedUrl] = useState<string | null>(null);
  const [uploadingLayout, setUploadingLayout] = useState(false);

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

  // =====================
  // Helpers
  // =====================

  const normalizeName = (s?: string | null) =>
    (s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const parsePastedTable = (text: string) => {
    const lines = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .filter((l) => l.trim().length > 0);

    if (lines.length === 0) return { headers: [], rows: [] };

    const guessSep = (s: string): string => {
      if (s.includes("\t")) return "\t";
      if ((s.match(/;/g) || []).length >= (s.match(/,/g) || []).length) return ";";
      return ",";
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
    m.publicId = find(["id", "#", "publicid", "codigo", "cod", "numero", "nº"]) ?? hdrs[0];
    m.name = find(["nome", "name", "crianca", "child"]);
    m.birthDate = find(["nascimento", "data de nascimento", "datanascimento", "birthdate", "dn"]);
    m.category = find(["categoria", "category", "grupo"]);
    m.wantedGift = find(["presente", "presentedesejado", "wantedgift", "pedido", "desejo"]);
    m.description = find(["descricao", "description", "obs", "observacao"]);
    return m;
  };

  const parseBrazilianDate = (s: string): string | null => {
    // espera formato DD/MM/YYYY
    const parts = s.split("/");
    if (parts.length !== 3) return null;
    const [ddStr, mmStr, yyyyStr] = parts;
    const dd = parseInt(ddStr, 10);
    const mm = parseInt(mmStr, 10);
    const yyyy = parseInt(yyyyStr, 10);
    if (!dd || !mm || !yyyy) return null;
    const date = new Date(yyyy, mm - 1, dd);
    if (isNaN(date.getTime())) return null;
    // garante que o que o usuário digitou é coerente (ex: 32/13/2020 deve cair aqui)
    if (date.getFullYear() !== yyyy || date.getMonth() + 1 !== mm || date.getDate() !== dd) return null;
    return date.toISOString().split("T")[0]; // YYYY-MM-DD
  };

  const formatBrazilianDate = (iso?: string | null) => {
    if (!iso) return "—";
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

  // =====================
  // Carregar opções Passo 1
  // =====================

  useEffect(() => {
    const loadCities = async () => {
      try {
        const res = await apiFetch(apiPath("/cities"), { headers: { accept: "application/json" } }, token);
        if (!res.ok) return;
        const js = await res.json();
        setCities(Array.isArray(js?.items) ? js.items : js);
      } catch {}
    };
    const loadCampaigns = async () => {
      try {
        const res = await apiFetch(apiPath("/campaigns?status=ACTIVE"), { headers: { accept: "application/json" } }, token);
        if (!res.ok) return;
        const js = await res.json();
        setCampaigns(Array.isArray(js?.items) ? js.items : js);
      } catch {}
    };
    loadCities();
    loadCampaigns();
  }, [token]);

  useEffect(() => {
    const loadCommunities = async () => {
      if (!cityId) { setCommunities([]); setCommunityId(""); return; }
      try {
        const res = await apiFetch(apiPath(`/communities?cityId=${encodeURIComponent(cityId)}`), { headers: { accept: "application/json" } }, token);
        if (!res.ok) return;
        const js = await res.json();
        setCommunities(Array.isArray(js?.items) ? js.items : js);
      } catch {}
    };
    loadCommunities();
  }, [cityId, token]);

  useEffect(() => {
    const loadSchools = async () => {
      if (!communityId) { setSchools([]); setSchoolId(""); return; }
      try {
        const res = await apiFetch(apiPath(`/schools?communityId=${encodeURIComponent(communityId)}`), { headers: { accept: "application/json" } }, token);
        if (!res.ok) return;
        const js = await res.json();
        setSchools(Array.isArray(js?.items) ? js.items : js);
      } catch {}
    };
    loadSchools();
  }, [communityId, token]);

  // =====================
  // Reações Passo 2
  // =====================

  useEffect(() => {
    if (!rawText.trim()) {
      setHeaders([]); setRows([]); setColMap({}); setDrafts([]); setLocalErrors([]);
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

  // =====================
  // Upload de layout (Passo 3)
  // =====================

  const doUploadLayout = async () => {
    if (!campaignId || !layoutFile) return;
    setUploadingLayout(true);
    try {
      const fd = new FormData();
      fd.append("file", layoutFile);
      const res = await apiFetch(apiPath(`/campaigns/${campaignId}/layout`), { method: "POST", body: fd }, token);
      if (!res.ok) throw new Error("Falha ao enviar layout");
      const json = await res.json().catch(() => ({}));
      setLayoutUploadedUrl(json?.url ?? "(enviado)");
    } catch (e: any) {
      alert(e?.message || "Erro no upload do layout");
      setLayoutUploadedUrl(null);
    } finally {
      setUploadingLayout(false);
    }
  };

  const layoutSrc = useMemo(() => {
    if (layoutUploadedUrl) return layoutUploadedUrl;
    if (layoutFile) return URL.createObjectURL(layoutFile);
    return null;
  }, [layoutUploadedUrl, layoutFile]);

  // =====================
  // Fotos (Passo 4): auto-match
  // =====================

  useEffect(() => {
    if (files.length === 0 || drafts.length === 0) { setPhotoMap({}); setPhotoIssues([]); return; }
    const issues: string[] = [];
    const map: Record<string, File | null> = {};

    const byPublicId = new Map<string, DraftChild>();
    drafts.forEach((d) => byPublicId.set(String(d.publicId).trim(), d));

    const byName = new Map<string, DraftChild>();
    drafts.forEach((d) => byName.set(normalizeName(d.name), d));

    files.forEach((f) => {
      const base = f.name.replace(/\.[^.]+$/, "");
      const m = base.match(/^(\d{1,12})/);
      if (m) {
        const pid = m[1];
        if (byPublicId.has(pid)) { map[pid] = f; return; }
      }
      const nm = normalizeName(base);
      if (byName.has(nm)) { map[String(byName.get(nm)!.publicId)] = f; return; }
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

  // =====================
  // Build drafts a partir da tabela (usa data BR)
  // =====================

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
      const name = get(r, map.name) ?? "";
      const birthDateRaw = get(r, map.birthDate);
      const birthDate = birthDateRaw ? parseBrazilianDate(birthDateRaw) : undefined;
      const category = get(r, map.category);
      const wantedGift = get(r, map.wantedGift);
      const description = get(r, map.description);

      const d: DraftChild = {
        publicId: publicIdRaw ?? "",
        name,
        birthDate,
        cityName: city?.name || undefined,
        state: city?.state || undefined,
        category: category || undefined,
        wantedGift: wantedGift || undefined,
        description: description || undefined,
      };

      if (!d.publicId || String(d.publicId).trim() === "") {
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

  // =====================
  // Composição de imagem (Passo 5)
  // =====================

  const composeOne = async (childFile: File, layoutSrc: string, size = { w: 1080, h: 1350 }) => {
    const loadImg = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous"; // caso o layout esteja em CDN com CORS habilitado
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

    const childSrc = URL.createObjectURL(childFile);
    try {
      const [childImg, layoutImg] = await Promise.all([loadImg(childSrc), loadImg(layoutSrc)]);
      const canvas = document.createElement("canvas");
      canvas.width = size.w;
      canvas.height = size.h;
      const ctx = canvas.getContext("2d")!;

      // 1) desenha a foto da criança "cover"
      const coverDraw = (img: HTMLImageElement) => {
        const { width: W, height: H } = canvas;
        const iw = img.width, ih = img.height;
        const r = Math.max(W / iw, H / ih);
        const nw = iw * r, nh = ih * r;
        const dx = (W - nw) / 2;
        const dy = (H - nh) / 2;
        ctx.drawImage(img, dx, dy, nw, nh);
      };
      coverDraw(childImg);

      // 2) desenha o layout por cima (assume PNG com transparência onde a foto deve aparecer)
      ctx.drawImage(layoutImg, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      URL.revokeObjectURL(childSrc);
      return dataUrl;
    } catch (e) {
      URL.revokeObjectURL(childSrc);
      throw e;
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!layoutSrc) { setComposed({}); return; }
      setComposing(true);
      const out: Record<string, string> = {};
      const entries = Object.entries(photoMap).filter(([, f]) => !!f) as [string, File][];
      for (const [pid, file] of entries) {
        try {
          const img = await composeOne(file, layoutSrc);
          if (!cancelled) out[pid] = img;
        } catch {
          // ignora falhas individuais, mostra sem composição
        }
      }
      if (!cancelled) setComposed(out);
      setComposing(false);
    })();
    return () => { cancelled = true; };
  }, [photoMap, layoutSrc]);

  // =====================
  // Commit (mesmo de antes)
  // =====================

  const doCommit = async () => {
    setCommitting(true);
    setCommitResult(null);
    try {
      const childrenForApi = drafts.map(({ cityName, state, ...rest }) => rest); // opcional: tirar city/UF e deixar o backend usar context
      const res = await apiFetch(
        apiPath(`/children/bulk/commit`),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            children: childrenForApi,
            context: { cityId, communityId: communityId || null, schoolId: schoolId || null, campaignId },
          }),
        },
        token
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Falha ao salvar crianças. ${txt}`);
      }
      const result = await res.json().catch(() => ({}));
      setCommitResult(result);

      // Upload das fotos por publicId
      const uploadOne = async (pid: string, file: File) => {
        const fd = new FormData();
        fd.append("file", file);
        const r = await apiFetch(apiPath(`/children/${encodeURIComponent(pid)}/photo`), { method: "POST", body: fd }, token);
        if (!r.ok) {
          const t = await r.text().catch(() => "");
          throw new Error(`Foto de ${pid} falhou: ${t}`);
        }
      };

      for (const [pid, file] of Object.entries(photoMap)) {
        if (file) await uploadOne(pid, file);
      }

      alert("Cadastro em lote concluído com sucesso!");
    } catch (e: any) {
      alert(e?.message || "Erro ao concluir o cadastro");
    } finally {
      setCommitting(false);
    }
  };

  // =====================
  // UI
  // =====================

  const StepIndicator = () => (
    <div className="flex items-center gap-3 mb-6">
      {[
        { n: 1, label: "Contexto" },
        { n: 2, label: "Colar tabela" },
        { n: 3, label: "Layout" },
        { n: 4, label: "Fotos" },
        { n: 5, label: "Conferência" },
      ].map((s) => (
        <div key={s.n} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${step >= (s.n as Step) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500 border-gray-300"}`}>{s.n}</div>
          <span className={`text-sm ${step >= (s.n as Step) ? "text-gray-900" : "text-gray-500"}`}>{s.label}</span>
          {s.n !== 5 && <div className="w-10 border-t border-gray-300 mx-2" />}
        </div>
      ))}
    </div>
  );

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
                    <select className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500" value={cityId} onChange={(e) => { setCityId(e.target.value); setCommunityId(""); setSchoolId(""); }}>
                      <option value="">Selecione…</option>
                      {cities.map((c) => (<option key={c.id} value={c.id}>{c.name}{c.state ? `/${c.state}` : ""}</option>))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Comunidade (opcional)</label>
                    <select className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500" value={communityId} onChange={(e) => { setCommunityId(e.target.value); setSchoolId(""); }} disabled={!cityId}>
                      <option value="">—</option>
                      {communities.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Escola (opcional)</label>
                    <select className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} disabled={!communityId}>
                      <option value="">—</option>
                      {schools.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Campanha *</label>
                    <select className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                      <option value="">Selecione…</option>
                      {campaigns.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Somente campanhas ativas são listadas.</p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end">
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50" disabled={!canGoStep2} onClick={() => setStep(2)}>
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
                <textarea className="w-full min-h-[160px] rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 p-3" placeholder="Cole (Ctrl+V) os dados aqui. A primeira linha deve conter os cabeçalhos." value={rawText} onChange={(e) => setRawText(e.target.value)} />
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-2"><ClipboardPaste className="w-4 h-4" /> Dica: TAB (TSV) do Excel/Sheets é reconhecido automaticamente. Datas devem estar no formato DD/MM/AAAA.</p>
              </div>

              {headers.length > 0 && (
                <div className="rounded-xl border border-gray-200 p-4 bg-white">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Columns2 className="w-5 h-5 text-blue-600" /> Mapeie as colunas</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {([
                      { key: "publicId",   label: "Public ID (obrigatório)" },
                      { key: "name",       label: "Nome (obrigatório)" },
                      { key: "birthDate",  label: "Data de nascimento (DD/MM/AAAA)" },
                      { key: "category",   label: "Categoria" },
                      { key: "wantedGift", label: "Presente desejado" },
                      { key: "description",label: "Descrição/Obs" },
                    ] as const).map((f) => (
                      <div key={f.key} className="flex items-center gap-3">
                        <label className="w-56 text-sm text-gray-700">{f.label}</label>
                        <select className="flex-1 rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500" value={(colMap as any)[f.key] ?? ""} onChange={(e) => setColMap((m) => ({ ...m, [f.key]: e.target.value || undefined }))}>
                          <option value="">— (ignorar)</option>
                          {headers.map((h) => (<option key={h} value={h}>{h}</option>))}
                        </select>
                      </div>
                    ))}
                  </div>

                  <div className="text-xs text-gray-500 mb-2">Cidade e UF não são lidas da tabela: serão aplicadas automaticamente conforme a Cidade escolhida no passo 1.</div>
                  <div className="mt-2 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">{headers.map((h) => (<th key={h} className="px-3 py-2 text-left font-semibold text-gray-700">{h}</th>))}</tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rows.slice(0, 10).map((r, i) => (
                          <tr key={i}>{r.map((c, j) => (<td key={j} className="px-3 py-2 text-gray-700">{c}</td>))}</tr>
                        ))}
                      </tbody>
                    </table>
                    {rows.length > 10 && (<p className="text-xs text-gray-500 mt-2">Mostrando 10 de {rows.length} linhas para pré-visualização.</p>)}
                  </div>

                  {localErrors.length > 0 ? (
                    <div className="mt-4 p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800">
                      <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="w-4 h-4" /> Problemas encontrados</div>
                      <ul className="mt-2 list-disc ml-5 text-xs">{localErrors.slice(0, 8).map((e, idx) => <li key={idx}>{e}</li>)}</ul>
                      {localErrors.length > 8 && <p className="text-xs mt-1">…e mais {localErrors.length - 8}.</p>}
                    </div>
                  ) : (
                    drafts.length > 0 && (
                      <div className="mt-4 p-3 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {drafts.length} linhas válidas para importação.</div>
                    )
                  )}

                  <div className="mt-6 flex items-center justify-between">
                    <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4" /> Voltar</button>
                    <div className="flex items-center gap-3">
                      <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700" onClick={() => setRawText("")}><X className="w-4 h-4" /> Limpar</button>
                      <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50" disabled={!(drafts.length > 0 && localErrors.length === 0 && colMap.publicId && colMap.name)} onClick={() => setStep(3)}>
                        Próximo <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: LAYOUT */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-200 p-4 bg-white">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><LayoutTemplate className="w-5 h-5 text-blue-600" /> Upload do layout da campanha</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Campanha</label>
                    <input className="w-full rounded-lg border border-gray-200 p-2 bg-gray-50" value={campaigns.find((c) => c.id === campaignId)?.name || campaignId} readOnly />
                    <p className="text-xs text-gray-500 mt-1">Definida no passo 1.</p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Arquivo do layout</label>
                    <input type="file" accept="image/*" onChange={(e) => setLayoutFile(e.target.files?.[0] || null)} />
                    <div className="mt-3 flex items-center gap-3">
                      <button disabled={!campaignId || !layoutFile || uploadingLayout} onClick={doUploadLayout} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
                        <Upload className="w-4 h-4" /> {uploadingLayout ? "Enviando…" : "Enviar layout"}
                      </button>
                      {layoutUploadedUrl && (<span className="text-sm text-emerald-700">Enviado ✓ {layoutUploadedUrl}</span>)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700" onClick={() => setStep(2)}><ArrowLeft className="w-4 h-4" /> Voltar</button>
                <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setStep(4)}>
                  Próximo <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: FOTOS */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-200 p-4 bg-white">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><FileImage className="w-5 h-5 text-blue-600" /> Upload das fotos</h3>
                <div className="flex items-center gap-3">
                  <input type="file" multiple accept="image/*" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
                  <p className="text-xs text-gray-500">Dica: nomeie os arquivos como <strong>123_foto.jpg</strong> (onde 123 é o <em>publicId</em>) ou exatamente o nome da criança.</p>
                </div>

                {Object.keys(photoMap).length > 0 && (
                  <div className="mt-6 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50"><th className="px-3 py-2 text-left">publicId</th><th className="px-3 py-2 text-left">Nome</th><th className="px-3 py-2 text-left">Foto associada</th></tr>
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
                                  <ImageIcon className={`w-4 h-4 ${file ? "text-emerald-600" : "text-gray-400"}`} />
                                  <span className="text-gray-700">{file ? file.name : "— sem foto"}</span>
                                  <select className="ml-3 rounded border border-gray-300 p-1" value={file ? file.name : ""} onChange={(e) => {
                                    const fname = e.target.value;
                                    setPhotoMap((m) => ({ ...m, [pid]: fname ? files.find((f) => f.name === fname) || null : null }));
                                  }}>
                                    <option value="">(sem foto)</option>
                                    {files.map((f) => (<option key={f.name} value={f.name}>{f.name}</option>))}
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
                    <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="w-4 h-4" /> Atenção</div>
                    {photoIssues.length > 0 && (<ul className="mt-2 list-disc ml-5 text-xs">{photoIssues.slice(0, 6).map((e, idx) => <li key={idx}>{e}</li>)}</ul>)}
                    {unmatchedCount > 0 && <p className="text-xs mt-2">Crianças sem foto associada: {unmatchedCount}.</p>}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700" onClick={() => setStep(3)}><ArrowLeft className="w-4 h-4" /> Voltar</button>
                <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50" disabled={!canGoStep5} onClick={() => setStep(5)}>
                  Próximo <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: CONFERÊNCIA */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-200 p-4 bg-white">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-blue-600" /> Conferência final</h3>

                {!layoutSrc && (
                  <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 mb-4">
                    Para ver a prévia composta, envie um layout (Passo 3).
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
                            // imagem composta gerada no canvas
                            <img src={img} alt={`Prévia ${d.name}`} className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-xs text-gray-500 p-4 text-center">
                              {file ? "Gerando prévia…" : "Sem foto associada"}
                            </div>
                          )}
                        </div>
                        <div className="p-4 space-y-1">
                          <div className="text-sm font-semibold text-gray-900 truncate">{d.name}</div>
                          <div className="text-xs text-gray-500">ID: {pid}</div>
                          <div className="text-xs text-gray-500">Nasc.: {formatBrazilianDate(d.birthDate)}</div>
                          {d.category && (<div className="text-xs text-gray-500">Categoria: {d.category}</div>)}
                          {d.wantedGift && (<div className="text-xs text-gray-500">Desejo: {d.wantedGift}</div>)}
                          <div className="text-xs text-gray-500">Cidade/UF: {d.cityName || "—"}{d.state ? `/${d.state}` : ""}</div>

                          {img && (
                            <button onClick={() => downloadDataUrl(img, `preview_${pid}.jpg`)} className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs">
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
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700" onClick={() => setStep(4)}><ArrowLeft className="w-4 h-4" /> Voltar</button>
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50" disabled={committing || localErrors.length > 0} onClick={doCommit}>
                    {committing ? "Confirmando…" : "Confirmar e cadastrar"}
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
      </div>
    </div>
  );
}

// =====================
// Utils UI
// =====================

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
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
