import { useAppState, useModal } from '../state/AppContext';
import { Modal, Button } from './ui';

export function ModalContainer(): React.JSX.Element {
  const { modal } = useAppState();
  const { hideModal } = useModal();

  if (!modal) return <></>;

  const handleConfirm = (): void => {
    modal.onConfirm?.();
    hideModal();
  };

  const handleCancel = (): void => {
    modal.onCancel?.();
    hideModal();
  };

  return (
    <Modal
      open={!!modal}
      onClose={handleCancel}
      title={modal.title}
      variant={modal.variant}
      footer={
        <div className="modal__actions">
          {modal.cancelLabel !== undefined && (
            <Button variant="ghost" onClick={handleCancel}>
              {modal.cancelLabel || 'Cancelar'}
            </Button>
          )}
          <Button variant={modal.variant === 'danger' ? 'danger' : 'primary'} onClick={handleConfirm}>
            {modal.confirmLabel || 'Confirmar'}
          </Button>
        </div>
      }
    >
      <p>{modal.message}</p>
    </Modal>
  );
}
