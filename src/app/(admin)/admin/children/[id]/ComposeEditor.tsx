'use client';

import ComposerModal from '@/components/media/ComposerModal';
import type { ComposeSample } from '@/components/media/ComposedImage';
import type { ComposeConfig } from '@/components/media/composeConfig';

/**
 * Ajuste do enquadramento de UMA foto de UMA campanha. Salva em ChildImage.Config
 * (o que o apadrinhamento usa para montar a arte) e já troca a imagem para o
 * layout atual da campanha/cidade.
 */
export default function ComposeEditor({
  imageId,
  photoUrl,
  layoutUrl,
  frameId,
  initialConfig,
  layoutConfig,
  sample,
  title,
  onClose,
  onSaved,
}: {
  imageId: string;
  photoUrl: string;
  layoutUrl: string;
  frameId?: string | null;
  initialConfig: ComposeConfig;
  /** composição padrão do layout, para "voltar ao padrão do layout" */
  layoutConfig: ComposeConfig;
  sample: ComposeSample;
  title: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  async function save(config: ComposeConfig) {
    const res = await fetch(`/api/admin/child-images/${imageId}/compose`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config, frameId: frameId ?? undefined }),
    });
    if (!res.ok) {
      alert('Falha ao salvar o enquadramento.');
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <ComposerModal
      title="Ajustar enquadramento desta foto"
      subtitle={title}
      photoUrl={photoUrl}
      layoutUrl={layoutUrl}
      initialConfig={initialConfig}
      resetConfig={layoutConfig}
      sample={sample}
      footer={<span className="text-xs text-gray-500">Vale só para esta criança nesta campanha. O padrão do layout é configurado na tela da campanha.</span>}
      onClose={onClose}
      onSave={save}
    />
  );
}
