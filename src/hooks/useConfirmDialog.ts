import { useState, useCallback } from 'react';

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface DialogState extends ConfirmOptions {
  open: boolean;
  description: string;
  onConfirm: () => void;
}

const CLOSED: DialogState = {
  open: false,
  description: '',
  onConfirm: () => {},
};

export const useConfirmDialog = () => {
  const [state, setState] = useState<DialogState>(CLOSED);

  const ask = useCallback((description: string, onConfirm: () => void, opts?: ConfirmOptions) => {
    setState({ open: true, description, onConfirm, ...opts });
  }, []);

  const handleConfirm = useCallback(() => {
    state.onConfirm();
    setState(CLOSED);
  }, [state]);

  const handleCancel = useCallback(() => {
    setState(CLOSED);
  }, []);

  return {
    ask,
    confirmDialogProps: {
      open: state.open,
      description: state.description,
      title: state.title,
      confirmLabel: state.confirmLabel,
      cancelLabel: state.cancelLabel,
      destructive: state.destructive,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
  };
};
