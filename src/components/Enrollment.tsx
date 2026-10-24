import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { openQuestInDiscord } from '../lib/quest-actions';
import { toAppError } from '../lib/ipc';
import { duration, taskLabel } from '../lib/quests';
import type { OfferReview, EnrollmentRun, DesktopSelectionRun, EnrollmentResult } from '../types/enrollment';
const Context=createContext<{review: (id: string)=>void; disabled: boolean; selectDesktop?: DesktopSelectionRun; activeQuestId?: string | null; continuousWork: boolean}|null>(null);
export const useEnrollment=()=>useContext(Context);

export function EnrollmentProvider({run,refresh,disabled,onActiveChange,children,continuousWork=false,selectDesktop,activeQuestId}:{run:EnrollmentRun;refresh:()=>void;disabled:boolean;onActiveChange:(active:boolean)=>void;children:ReactNode;continuousWork?:boolean;selectDesktop?:DesktopSelectionRun;activeQuestId?:string|null}) {
 const [id,setId]=useState<string|null>(null),[offer,setOffer]=useState<OfferReview|null>(null);
 const [pending,setPending]=useState(false),[error,setError]=useState<string|null>(null),[notice,setNotice]=useState('');
 const busy=useRef(false), dialog=useRef<HTMLDialogElement>(null), cancel=useRef<HTMLButtonElement>(null), origin=useRef<HTMLElement|null>(null);
 function acceptedNotice(result: Extract<EnrollmentResult,{status:'accepted'}>) { return result.message ?? (result.desktopSelection==='unconfirmed' ? 'Quest accepted, but Desktop selection is unconfirmed. Find it in Ongoing to choose Desktop or continue in Discord.' : 'Discord confirmed acceptance. Find the quest in Ongoing.'); }
 useEffect(()=>{const element=dialog.current;if(id&&element){if(!element.open){if(element.showModal)element.showModal();else element.setAttribute('open','');}if(!pending)cancel.current?.focus();}else element?.close?.();},[id,pending]);
 useEffect(()=>{onActiveChange(id!==null);return()=>onActiveChange(false);},[id,onActiveChange]);
 useEffect(()=>{if(!id&&notice)document.getElementById('view-title')?.focus();},[id,notice]);
 function close(){if(busy.current)return;dialog.current?.close?.();setId(null);setOffer(null);setError(null);if(origin.current?.isConnected)origin.current.focus();else document.getElementById('view-title')?.focus();}
 async function review(questId:string){
  if(disabled||busy.current||id)return;
  origin.current=document.activeElement as HTMLElement;setId(questId);setOffer(null);setError(null);setNotice('');busy.current=true;setPending(true);
  try{const result=await run(questId);if(result.status==='review')setOffer(result);else if(result.status==='accepted'){setNotice(acceptedNotice(result));setId(null);refresh();}else setError(result.message);}
  catch(failure){setError(toAppError(failure).message);}
  finally{busy.current=false;setPending(false);}
 }
 async function confirm(){
  if(!offer||disabled||busy.current)return;
  busy.current=true;setPending(true);setError(null);
  try{const result=await run(offer.id,offer.revision);refresh();if(result.status==='accepted'){setNotice(acceptedNotice(result));setId(null);origin.current?.focus();}else{setOffer(null);setError(result.status==='review'?'Review this offer again.':result.message);}}
  catch(failure){setOffer(null);setError(toAppError(failure).message);refresh();}
  finally{busy.current=false;setPending(false);}
 }
 async function handoff(){if(!id)return;try{await openQuestInDiscord(id);}catch(failure){setError(toAppError(failure).message);}}
 return <Context value={{review,disabled:disabled||pending||id!==null,selectDesktop,activeQuestId,continuousWork}}>{children}
  {notice&&<p className="acceptance-notice" role="status">{notice}</p>}
  {id&&<dialog ref={dialog} className="acceptance-dialog" aria-modal="true" aria-labelledby="accept-title" aria-describedby="accept-description" onCancel={event=>{event.preventDefault();close();}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();close();}}}>
   <h2 id="accept-title">{offer?`Accept ${offer.name}?`:'Review quest'}</h2>
   <p id="accept-description">{continuousWork ? 'Continuous Work is on. Accepting this quest adds it to the active queue; it may start automatically when its turn arrives.' : 'Acceptance adds this quest to your Discord account. Work starts only when you choose Work my quests.'}</p>
   {pending&&<p role="status">{offer?'Waiting for Discord to confirm…':'Reading the current offer…'}</p>}
   {offer?.platform==='desktop'&&<p>Platform: <strong>Desktop</strong>{offer.requiresDesktopSelection&&' — selected after Discord confirms acceptance.'}</p>}
   {offer&&<><p className="acceptance-reward">{offer.reward}</p>{offer.requirements.length>1&&<p>Choose one task:</p>}<ul>{offer.requirements.map(task=><li key={task.kind}>{taskLabel(task.kind)} for {duration(task.target)}</li>)}</ul><p>Ends {new Date(offer.expiresAt).toLocaleString()}</p><p>Only accept if you meet the offer requirements. Review full offer details in Discord if you are unsure.</p></>}
   {error&&<p role="alert">{error}</p>}
   {disabled&&<p role="status">Reconnect to Discord before confirming.</p>}
   <div className="acceptance-buttons"><button ref={cancel} className="button secondary" disabled={pending} onClick={close}>{offer?'Cancel':'Close'}</button><button className="button secondary" disabled={pending} onClick={()=>void handoff()}>Open in Discord</button>{offer&&<button className="button primary" disabled={pending||disabled} onClick={()=>void confirm()}>Confirm acceptance</button>}</div>
  </dialog>}
 </Context>;
}
