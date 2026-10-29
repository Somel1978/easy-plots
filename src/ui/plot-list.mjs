/** Translate bounded physical index pages into a user-visible plot page. */
export async function readPlotPage(listDrafts,{cursor='0:0',limit=12,pageBudget=8}={}){
 if(typeof listDrafts!=='function'||!Number.isInteger(limit)||limit<1||limit>16||!Number.isInteger(pageBudget)||pageBudget<1||pageBudget>8)throw Error('A bounded plot page is required');
 const items=[],seen=new Set();let nextCursor=cursor,pagesRead=0;
 do{
  if(seen.has(nextCursor))throw Error('The draft index repeated a page. Refresh the plot list.');seen.add(nextCursor);
  const page=await listDrafts({cursor:nextCursor,limit:limit-items.length});pagesRead++;
  if(!Array.isArray(page.items)||page.items.length>limit-items.length)throw Error('The draft index returned an invalid page');
  items.push(...page.items);nextCursor=page.nextCursor??null;
 }while(nextCursor&&items.length<limit&&pagesRead<pageBudget);
 return {items,nextCursor,pagesRead,complete:nextCursor===null};
}
