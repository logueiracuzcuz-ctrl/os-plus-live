import { useState, useCallback } from 'react';
import { Check, Copy } from 'lucide-react';
import { useToast } from '../../state/AppContext';

interface CopyButtonProps {
  text: string;
  label?: string;
  successMessage?: string;
}

export function CopyButton({
  text,
  label = 'Copiar',
  successMessage = 'Copiado!',
}: CopyButtonProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast('success', successMessage);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('error', 'Falha ao copiar');
    }
  }, [text, successMessage, toast]);

  return (
    <button
      type="button"
      className="btn btn--ghost btn--sm"
      onClick={handleCopy}
      aria-label={copied ? successMessage : label}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      <span>{copied ? 'Copiado' : label}</span>
    </button>
  );
}
