import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConnectionStatus } from './ConnectionStatus';
describe('Discord recovery controls',()=>{
 it('explains interruption and requires a deliberate restart click',async()=>{
  const restart=vi.fn();render(<ConnectionStatus state="restart-needed" status={{installed:true,ready:false,running:true,action:'Restarting Discord interrupts your activity.',profile:null}} error={null} busy={false} onRestart={restart} onRetry={()=>{}}/>);
  expect(restart).not.toHaveBeenCalled();expect(screen.getByText(/interrupts/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button',{name:'Restart Discord'}));expect(restart).toHaveBeenCalledTimes(1);
 });
 it('offers recovery after failure and removes resolved error text',async()=>{
  const retry=vi.fn();const status={installed:true,ready:true,running:true,action:null,profile:null};
  const {rerender}=render(<ConnectionStatus state="failed" status={status} error={{code:'IO_ERROR',message:'Connection lost',retryable:true}} busy={false} onRestart={()=>{}} onRetry={retry}/>);
  await userEvent.click(screen.getByRole('button',{name:'Try again'}));expect(retry).toHaveBeenCalledTimes(1);
  rerender(<ConnectionStatus state="connected" status={status} error={null} busy={false} onRestart={()=>{}} onRetry={retry}/>);
  expect(screen.queryByText('Connection lost')).not.toBeInTheDocument();expect(screen.getByText('Discord connected')).toBeInTheDocument();
 });
});
