import {STEP_CATEGORIES,stepCatalog,discoverSteps} from '../editor/step-library.mjs';
const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=String(text);n.className=cls;return n;};
export function renderStepLibrary({types,selectedNode,state,canEdit=true}={}){
 const catalog=stepCatalog(types),root=el('details','','ep-step-library');root.dataset.library='';root.open=state.open===true;root.append(el('summary','Add a story step'));
 root.addEventListener('toggle',()=>{state.open=root.open;});
 const body=el('div','','ep-step-browser'),context=el('p',selectedNode?`Related to “${selectedNode.label??catalog.find(s=>s.id===selectedNode.typeId)?.label??'plot start'}”. Adding a step does not connect or run it.`:'Choose what you want this part of the story to do.','ep-form-help');body.append(context);
 const search=el('input');search.type='search';search.dataset.field='node-search';search.value=state.query??'';search.placeholder='Find a story step';const searchLabel=el('label','Search steps');searchLabel.append(search);body.append(searchLabel);
 const categories=el('nav','','ep-step-categories');categories.setAttribute('aria-label','Step categories');body.append(categories);
 const heading=el('header','','ep-step-results-heading'),results=el('div','','ep-step-results'),pages=el('nav','','ep-step-pages');body.append(heading,results,pages);
 const selected=el('input');selected.type='hidden';selected.dataset.field='node-type';selected.setAttribute('aria-label','Selected step type');selected.value=state.selectedId??'';
 const choose=el('button','Add selected step','ep-primary');choose.type='button';choose.dataset.action='add-node';choose.disabled=true;body.append(selected,choose);root.append(body);
 const categoryButton=(id,name)=>{const b=el('button',name);b.type='button';b.dataset.stepCategory=id;b.setAttribute('aria-pressed',String((state.category??'recommended')===id));b.addEventListener('click',()=>{state.category=id;state.page=0;state.selectedId=null;render();});categories.append(b);};
 categoryButton('recommended','Related steps');for(const category of STEP_CATEGORIES){const count=catalog.filter(s=>s.category===category.id).length;if(count)categoryButton(category.id,`${category.label} · ${count}`);}
 function render(){
  const category=state.category??'recommended',page=discoverSteps(catalog,{category,query:state.query??'',selectedType:selectedNode?.typeId,page:state.page??0});state.page=page.page;
  for(const b of categories.children)b.setAttribute('aria-pressed',String(b.dataset.stepCategory===category));
  const info=STEP_CATEGORIES.find(c=>c.id===category);heading.replaceChildren(el('strong',info?.label??(state.query?'Search all categories':'Related steps')),el('small',`${page.total} ${page.total===1?'step':'steps'}`));
  if(info)heading.append(el('p',info.description,'ep-form-help'));
  results.replaceChildren();if(!page.items.length)results.append(el('p','No matching steps. Try another category or search term.'));
  for(const step of page.items){const card=el('button','','ep-step-choice');card.type='button';card.dataset.stepType=step.id;card.setAttribute('aria-pressed',String(state.selectedId===step.id));card.append(el('strong',step.label),el('span',step.description),el('small',step.effect?'GM review required':STEP_CATEGORIES.find(c=>c.id===step.category).label));card.addEventListener('click',()=>{state.selectedId=step.id;render();});results.append(card);}
  selected.value=page.items.some(s=>s.id===state.selectedId)?state.selectedId:'';choose.disabled=!canEdit||!selected.value;choose.textContent=selected.value?`Add ${page.items.find(s=>s.id===selected.value).label.toLowerCase()}`:'Choose a step to add';
  pages.replaceChildren();if(page.pages>1){for(const [name,delta] of [['Previous',-1],['Next',1]]){const b=el('button',name);b.type='button';b.disabled=delta<0?page.page===0:page.page+1===page.pages;b.addEventListener('click',()=>{state.page+=delta;state.selectedId=null;render();});pages.append(b);}pages.append(el('small',`Page ${page.page+1} of ${page.pages}`));}
 }
 search.addEventListener('input',()=>{state.query=search.value;state.page=0;state.selectedId=null;render();});render();return root;
}
