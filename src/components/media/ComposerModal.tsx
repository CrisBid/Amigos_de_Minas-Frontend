'use client';

import { ReactNode, useEffect, useState } from 'react';
import { ImagePlus, Loader2, RotateCcw, X } from 'lucide-react';
import LayoutComposer from './LayoutComposer';
import type { ComposeSample } from './ComposedImage';
import type { ComposeConfig } from './composeConfig';

/**
 * Janela do editor de composição. `onSave` recebe a composição final; o que
 * acontece com ela (salvar na foto, no layout, aplicar na migração) é de quem abre.
 */
export default function ComposerModal({
  title,
  subtitle,
  photoUrl,
  layoutUrl,
  initialConfig,
  resetConfig,
  resetLabel = 'Padrão do layout',
  sample,
  allowPhotoPick = false,
  footer,
  saveLabel = 'Salvar',
  onClose,
  onSave,
}: {
  title: string;
  subtitle?: string;
  photoUrl: string;
  layoutUrl: string;
  initialConfig: ComposeConfig;
  /** composição para o botão "voltar ao padrão" (omitido = sem botão) */
  resetConfig?: ComposeConfig;
  resetLabel?: string;
  sample: ComposeSample;
  /** permite escolher outra foto só para visualizar (não é enviada) */
  allowPhotoPick?: boolean;
  /** conteúdo extra no rodapé (ex.: opções de aplicação) */
  footer?: ReactNode;
  saveLabel?: string;
  onClose: () => void;
  onSave: (cfg: ComposeConfig) => Promise<void> | void;
}) {
  const [cfg, setCfg] = useState<ComposeConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  useEffect(() => () => { if (previewPhoto) URL.revokeObjectURL(previewPhoto); }, [previewPhoto]);

  // Esc fecha
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  async function save() {
    setSaving(true);
    try {
      await onSave(cfg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true">
      <div className="bg-white w-full max-w-6xl h-[94vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {allowPhotoPick && (
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-gray-50 cursor-pointer" title="Só para visualizar; a foto não é enviada">
                <ImagePlus className="w-4 h-4" /> Foto de exemplo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) setPreviewPhoto(URL.createObjectURL(f));
                  }}
                />
              </label>
            )}
            {resetConfig && (
              <button
                onClick={() => setCfg(resetConfig)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-gray-50"
              >
                <RotateCcw className="w-4 h-4" /> {resetLabel}
              </button>
            )}
            <button onClick={onClose} disabled={saving} className="p-1.5 rounded-lg hover:bg-gray-100" title="Fechar (Esc)"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <LayoutComposer
            photoUrl={previewPhoto ?? photoUrl}
            layoutUrl={layoutUrl}
            value={cfg}
            onChange={setCfg}
            sample={sample}
          />
        </div>

        <div className="px-4 py-3 border-t flex flex-wrap items-center justify-between gap-3 bg-gray-50">
          <div className="text-sm text-gray-700 min-w-0">{footer}</div>
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg border bg-white text-sm hover:bg-gray-50">Cancelar</button>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} {saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
