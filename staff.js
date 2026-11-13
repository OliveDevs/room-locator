const form=document.getElementById('new-item'),status=document.getElementById('staff-status');
const lines=value=>value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
Promise.all([fetch('data.json?v=20261113b').then(r=>r.json()),fetch('room.json?v=20261113b').then(r=>r.json())]).then(([data,room])=>{
  const categories=[...new Set(data.kinds.map(x=>x.c))].sort();
  form.elements.category.innerHTML='<option value="">Choose category</option>'+categories.map(c=>'<option>'+c.replaceAll('&','&amp;')+'</option>').join('');
  form.elements.unit.innerHTML='<option value="">Choose unit</option>'+room.units.filter(u=>u.shelves).map(u=>'<option value="'+u.code+'">'+u.name.replaceAll('&','&amp;')+' ('+u.code+')</option>').join('');
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const f=form.elements,name=f.name.value.trim(),unit=room.units.find(u=>u.code===f.unit.value),shelf=Number(f.shelf.value),copies=Number(f.copies.value);
    if(data.kinds.some(k=>k.n.toLowerCase()===name.toLowerCase())){status.textContent='That item name already exists. Edit the existing entry instead.';return}
    if(!unit||shelf<1||shelf>unit.shelves){status.textContent='Choose a shelf within the selected unit.';return}
    if(!Number.isInteger(copies)||copies<1){status.textContent='Enter at least one copy.';return}
    const hashBytes=new Uint8Array(3);let hash;do{crypto.getRandomValues(hashBytes);hash=[...hashBytes].map(n=>n.toString(16).padStart(2,'0')).join('')}while(data.kinds.some(k=>k.h===hash));
    const item={n:name,c:f.category.value,t:f.type.value.trim(),x:copies,w:unit.name+', shelf '+shelf,in:true,d:f.description.value.trim(),h:hash,u:unit.code,s:shelf,need:lines(f.need.value),start:lines(f.start.value)};
    if(!item.t||!item.need.length||!item.start.length){status.textContent='Add a type, preparation list, and first steps.';return}
    const tips=lines(f.tips.value);if(tips.length)item.tips=tips;
    if(f.manual.value.trim())item.r=[['Official maker instructions',f.manual.value.trim()]];
    if(f.photo.value.trim())item.p={url:f.photo.value.trim(),page:f.crediturl.value.trim()||'#',artist:f.credit.value.trim()||'IDeATe Lending',license:'Photo source'};
    data.kinds.push(item);data.kinds.sort((a,b)=>a.n.localeCompare(b.n));
    const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='data.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status.textContent='Downloaded updated data.json. Review it before uploading. New item QR code: '+hash+'.';
    form.reset();
  });
}).catch(()=>{status.textContent='Could not load the inventory. Open this page from the published site or a local web server.'});
