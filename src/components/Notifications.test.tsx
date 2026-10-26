import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {NotificationCenter, NotificationProvider, useNotifications} from './Notifications';
function Trigger(){const n=useNotifications();return <><button onClick={()=>n?.notify({key:'one',title:'Quest accepted',message:'Confirmed by Discord',kind:'success'})}>Accept example</button><button onClick={()=>n?.notify({title:'Quest completed',message:'Example completed',kind:'completed'})}>Complete example</button></>}
function show(){const completed=vi.fn();render(<NotificationProvider><Trigger/><NotificationCenter onCompleted={completed}/><input aria-label="Outside"/></NotificationProvider>);return completed;}
afterEach(()=>vi.useRealTimers());
it('expires routine feedback after five seconds while retaining unread instructions',()=>{
  vi.useFakeTimers();show();fireEvent.click(screen.getByText('Accept example'));
  expect(screen.getByRole('status')).toHaveTextContent('Confirmed by Discord');
  act(()=>{vi.advanceTimersByTime(5000)});expect(screen.queryByRole('status')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Notifications, 1 unread'}));
  fireEvent.click(screen.getByRole('button',{name:/Quest accepted.*Confirmed/}));
  expect(screen.getByRole('button',{name:'Notifications'})).toHaveAttribute('aria-expanded','true');
  expect(screen.getAllByText('Confirmed by Discord')).toHaveLength(2);
});
it('pauses expiry for hover and keyboard focus and gives a new event a full interval',()=>{
  vi.useFakeTimers();show();fireEvent.click(screen.getByText('Accept example'));
  act(()=>{vi.advanceTimersByTime(4000)});fireEvent.mouseEnter(screen.getByRole('status'));
  act(()=>{vi.advanceTimersByTime(9000)});expect(screen.getByRole('status')).toBeInTheDocument();
  fireEvent.mouseLeave(screen.getByRole('status'));act(()=>{vi.advanceTimersByTime(1000)});expect(screen.queryByRole('status')).toBeNull();
  fireEvent.click(screen.getByText('Complete example'));act(()=>{vi.advanceTimersByTime(4999)});expect(screen.getByRole('status')).toBeInTheDocument();
  act(()=>{vi.advanceTimersByTime(1)});expect(screen.queryByRole('status')).toBeNull();
});
it('deduplicates keyed notices, marks all read, routes completions, and closes without stealing outside focus',()=>{
  const completed=show();fireEvent.click(screen.getByText('Accept example'));fireEvent.click(screen.getByText('Accept example'));
  expect(screen.getByRole('button',{name:'Notifications, 1 unread'})).toBeInTheDocument();
  fireEvent.click(screen.getByText('Complete example'));fireEvent.click(screen.getByRole('button',{name:'View completed'}));expect(completed).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button',{name:'Notifications, 2 unread'}));
  fireEvent.click(screen.getByRole('button',{name:'Mark all read'}));
  const panel=screen.getByRole('region',{name:'Notifications'});expect(within(panel).getAllByRole('article')).toHaveLength(2);
  fireEvent.keyDown(document,{key:'Escape'});expect(screen.getByRole('button',{name:'Notifications'})).toHaveFocus();
  fireEvent.click(screen.getByRole('button',{name:'Notifications'}));const outside=screen.getByRole('textbox');outside.focus();fireEvent.pointerDown(outside);
  expect(screen.queryByRole('region',{name:'Notifications'})).toBeNull();expect(outside).toHaveFocus();
});
