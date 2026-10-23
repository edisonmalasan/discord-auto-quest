import { it,expect } from 'vitest';
import { auditText } from './terms.mjs';
it('rejects an added occurrence on an allowed path or changed allowed line',()=>{
 const token='scr'+'ipt';
 const line=`<${token} type="module"></${token}>`;
 const rules=[{path:'index.html',line,reason:'Required HTML syntax'}];
 expect(auditText('index.html',line,rules)).toEqual([]);
 expect(auditText('index.html',line+' private '+token,rules).length).toBe(1);
 expect(auditText('README.md',token,rules).length).toBe(1);
 expect(auditText('README.md','description of the product',rules)).toEqual([]);
});
