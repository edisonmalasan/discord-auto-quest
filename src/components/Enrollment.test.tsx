import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { EnrollmentProvider, useEnrollment } from './Enrollment';
const offer={status:'review' as const,id:'123',name:'Example',reward:'200 Orbs',expiresAt:'2099-01-01',requirements:[{kind:'PLAY_ON_DESKTOP',target:900}],revision:'revision'};
function Button(){const enrollment=useEnrollment(); return <button onClick={()=>enrollment?.review('123')}>Review offer</button>}
function show(run=vi.fn().mockResolvedValue(offer)) {
 const refresh=vi.fn();
 render(<EnrollmentProvider run={run} refresh={refresh} disabled={false} onActiveChange={()=>{}}><h1 id="view-title" tabIndex={-1}>Available quests</h1><Button/></EnrollmentProvider>);
 return {run,refresh};
}
it('requires confirmation and cancellation makes no acceptance call',async()=>{
 const {run}=show(); fireEvent.click(screen.getByText('Review offer'));
 const cancel=await screen.findByRole('button',{name:'Cancel'}); expect(cancel).toHaveFocus();
 expect(screen.getByRole('dialog')).toHaveTextContent('Example'); expect(run).toHaveBeenCalledTimes(1);
 fireEvent.click(cancel); expect(screen.queryByRole('dialog')).toBeNull(); expect(run).toHaveBeenCalledTimes(1);
});
it('confirms once and refreshes without starting Work',async()=>{
 const run=vi.fn().mockResolvedValueOnce(offer).mockResolvedValueOnce({status:'accepted',id:'123'});
 const {refresh}=show(run); fireEvent.click(screen.getByText('Review offer'));
 const accept=await screen.findByRole('button',{name:'Confirm acceptance'});
 fireEvent.click(accept); fireEvent.click(accept);
 await waitFor(()=>expect(refresh).toHaveBeenCalled()); expect(run.mock.calls).toEqual([['123'],['123','revision']]);
 expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.getByText(/confirmed acceptance/)).toBeInTheDocument();
 expect(screen.getByRole('heading',{name:'Available quests'})).toHaveFocus();
});
it('keeps uncertainty visible and prevents automatic retries',async()=>{
 const run=vi.fn().mockResolvedValueOnce(offer).mockResolvedValueOnce({status:'uncertain',message:'Check Discord before trying again.'});
 show(run); fireEvent.click(screen.getByText('Review offer')); fireEvent.click(await screen.findByRole('button',{name:'Confirm acceptance'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Check Discord');
 expect(run).toHaveBeenCalledTimes(2); expect(screen.queryByRole('button',{name:'Confirm acceptance'})).toBeNull();
 expect(screen.getByRole('button',{name:'Open in Discord'})).toBeInTheDocument();
});
it('Escape cancels a review without accepting',async()=>{
 const {run}=show(); fireEvent.click(screen.getByText('Review offer')); await screen.findByRole('dialog');
 fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape'}); expect(screen.queryByRole('dialog')).toBeNull(); expect(run).toHaveBeenCalledTimes(1);
});
