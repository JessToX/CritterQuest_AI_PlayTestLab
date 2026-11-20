'use client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRef, type Dispatch, type SetStateAction } from 'react';

interface Props {
  terminateConfirm: boolean;
  setTerminateConfirm: Dispatch<SetStateAction<boolean>>;
  stopping: boolean;
  terminateGame: () => Promise<void>;
}
export function TerminateDialog({
  terminateConfirm,
  setTerminateConfirm,
  stopping,
  terminateGame,
}: Props) {
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={terminateConfirm} onOpenChange={setTerminateConfirm}>
      <DialogContent initialFocus={cancel}>
        <DialogHeader>
          <DialogTitle>终止对局及本次批次</DialogTitle>
          <DialogDescription>
            立即停止出牌和后续对局，保存过程后生成各 AI
            的收尾总结；总结可单独取消。终止后不能继续本局。
          </DialogDescription>
        </DialogHeader>
        <Button
          ref={cancel}
          variant="outline"
          onClick={() => setTerminateConfirm(false)}
        >
          保留对局
        </Button>
        <Button
          variant="destructive"
          disabled={stopping}
          onClick={() => void terminateGame()}
        >
          确认终止
        </Button>
      </DialogContent>
    </Dialog>
  );
}
