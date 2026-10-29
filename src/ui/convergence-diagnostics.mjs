/** GM-only diagnostic rendering. All content uses textContent. */
export function appendConvergenceDiagnostics(container,{event=null,cascade=null}={}){
 const rows=(event?.evaluations??[]).flatMap(e=>(e.trace??[]).filter(t=>t.status?.startsWith('convergence-')||t.status==='cascade-stopped').map(t=>({graphId:e.graphId,...t})));
 if(!rows.length&&!cascade)return null;
 const details=document.createElement('details');details.className='ep-convergence-diagnostics';
 const summary=document.createElement('summary');summary.textContent='Convergence and causal budgets';details.append(summary);
 const explanation=document.createElement('p');explanation.textContent='These bounds control proposal evaluation. Continuing a causal event never approves or repeats its effects.';details.append(explanation);
 const output=document.createElement('pre');output.textContent=JSON.stringify({...(cascade?{cascade}:{}),...(rows.length?{trace:rows}:{})},null,2);details.append(output);container.append(details);return details;
}
