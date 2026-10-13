'use strict';
const $=id=>document.getElementById(id), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c])), fmt=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n);
const sampleCSV='Month,Completed,Backlog,Avg Days\nJan,42,18,4.8\nFeb,53,14,4.2\nMar,48,17,4.5\nApr,66,12,3.7\nMay,72,10,3.5\nJun,69,13,3.8\nJul,81,9,3.1\nAug,78,11,3.3\nSep,88,8,2.9\nOct,94,7,2.7\nNov,90,9,3.0\nDec,102,6,2.5';
let rows=[],columns=[],numeric=[],name='',page=0,filtered=[],lastsvg='',uploadVersion=0;
function parseCSV(text){
 text=text.replace(/^\uFEFF/,'');let records=[],row=[],field='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
  let c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++}else{quoted=false;closed=true}}else field+=c;continue}
  if(c==='"'){if(field.length||closed)throw Error('Unexpected quote in a CSV field.');quoted=true}
  else if(c===','){row.push(field);field='';closed=false}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()!==''))records.push(row);row=[];field='';closed=false}
  else{if(closed&&c.trim())throw Error('Unexpected text after a closing quote.');if(!closed)field+=c}
 }
 if(quoted)throw Error('An opening quote is missing its closing quote.');
 row.push(field);if(row.some(v=>v.trim()!==''))records.push(row);
 if(records.length<2)throw Error('Include a header row and at least one data row.');
 const headers=records.shift().map(s=>s.trim());
 if(headers.some(s=>!s)||new Set(headers).size!==headers.length)throw Error('Column headers must be nonempty and unique.');
 if(headers.length>60)throw Error('Use 60 columns or fewer.');
 return records.map((r,i)=>{if(r.length!==headers.length)throw Error(`Row ${i+2} has ${r.length} fields; expected ${headers.length}.`);return Object.fromEntries(headers.map((h,j)=>[h,r[j].trim()]))})
}
function number(v){if(typeof v==='number')return Number.isFinite(v)?v:null;if(typeof v!=='string'||!v.trim())return null;let s=v.trim();if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s))return null;let n=Number(s);return Number.isFinite(n)?n:null}
function parseJSON(text){let data=JSON.parse(text);if(!Array.isArray(data)||!data.length||data.some(r=>!r||typeof r!=='object'||Array.isArray(r)))throw Error('JSON must be an array of objects, such as [{"Month":"Jan","Value":42}].');if(data.some(r=>Object.values(r).some(v=>v!==null&&typeof v==='object')))throw Error('Use flat JSON records with text or numeric values.');return data}
function notify(message,error=false){$('notice').textContent=message;$('notice').className='notice'+(error?' error':'');$('notice').hidden=!message}
function load(data,filename,isSample=false){
 if(data.length>10000)throw Error('Use 10,000 rows or fewer.');let cols=[...new Set(data.flatMap(r=>Object.keys(r)))];if(!cols.length||cols.length>60||cols.some(c=>!c.trim()))throw Error('Use between 1 and 60 named columns.');
 let normalized=data.map(r=>Object.fromEntries(cols.map(c=>[c,r[c]??''])));let nums=cols.filter(c=>normalized.some(r=>number(r[c])!==null));
 rows=normalized;columns=cols;numeric=nums;name=filename;page=0;
 $('filename').textContent=filename;$('filename').title=filename;$('dataset-description').textContent=isSample?'Illustrative operations data':'Custom dataset · loaded locally';
 $('filter').value='';$('type').value='bar';$('aggregation').value='sum';setupFields();notify(numeric.length?'':'No numeric columns detected. Use “Count rows” to visualize category frequencies.');render()
}
function options(el,cols,current){el.replaceChildren(...cols.map(c=>{let o=document.createElement('option');o.value=c;o.textContent=c;return o}));if(cols.includes(current))el.value=current}
function setupFields(){let x=$('x').value,y=$('y').value;options($('x'),$('type').value==='scatter'?numeric:columns,x);options($('y'),numeric,y);if(!numeric.length)$('aggregation').value='count';$('y').disabled=$('aggregation').value==='count'&&$('type').value!=='scatter';$('aggfield').hidden=$('type').value==='scatter';$('xlabel').textContent=$('type').value==='scatter'?'Numeric X axis':'Category / X axis';if($('type').value==='scatter'&&numeric.length>1&&$('x').value===$('y').value)$('y').value=numeric[1];$('charthelp').textContent={bar:'Compare grouped categories. Sum, average, or count the matching rows.',line:'Explore an ordered sequence. Numbers and ISO dates sort in ascending order; text follows its first appearance.',scatter:'Compare two numeric columns. Each point is one row; missing or nonnumeric pairs are excluded.'}[$('type').value]}
function buildPoints(data,x,y,agg,type){
 if(type==='scatter')return data.flatMap((r,i)=>{let a=number(r[x]),b=number(r[y]);return a===null||b===null?[]:[{x:a,y:b,label:`Row ${i+1}`,n:1}]});
 let map=new Map();for(let r of data){let k=String(r[x]??'').trim()||'(Missing)',v=agg==='count'?1:number(r[y]);if(v===null)continue;let g=map.get(k)||{label:k,total:0,n:0};g.total+=v;g.n++;map.set(k,g)}
 let p=[...map.values()].map(g=>({label:g.label,y:agg==='mean'?g.total/g.n:g.total,n:g.n}));
 if(type==='line'){if(p.every(g=>number(g.label)!==null))p.sort((a,b)=>number(a.label)-number(b.label));else if(p.every(g=>/^\d{4}-\d{2}-\d{2}/.test(g.label)&&Number.isFinite(Date.parse(g.label))))p.sort((a,b)=>Date.parse(a.label)-Date.parse(b.label))}
 return p
}
function render(){
 $('tooltip').hidden=true;let query=$('filter').value.trim().toLowerCase();filtered=rows.filter(r=>Object.values(r).some(v=>String(v).toLowerCase().includes(query)));
 let type=$('type').value,x=$('x').value,y=$('y').value,agg=$('aggregation').value,nums=filtered.map(r=>number(r[y])).filter(v=>v!==null),total=nums.reduce((a,b)=>a+b,0);
 $('rows').textContent=fmt(filtered.length);$('totalrows').textContent=`of ${fmt(rows.length)} total`;$('columns').textContent=columns.length;$('numericcols').textContent=`${numeric.length} numeric columns`;
 let count=agg==='count'&&type!=='scatter';$('statlabel').textContent=count?'MATCHING ROWS':`${y||'NUMERIC VALUE'} · ${agg==='mean'&&type!=='scatter'?'AVERAGE':'TOTAL'}`;
 $('stattotal').textContent=count?fmt(filtered.length):nums.length?fmt(agg==='mean'&&type!=='scatter'?total/nums.length:total):'—';$('validvalues').textContent=count?'includes missing values':`${nums.length} valid · ${filtered.length-nums.length} excluded`;
 let points=buildPoints(filtered,x,y,agg,type);$('charttitle').textContent=type==='scatter'?`${y||'Value'} vs. ${x||'X'}`:`${count?'Row count':y||'Value'} by ${x||'category'}`;
 $('chartsubtitle').textContent=`${name} · ${type==='scatter'?'one point per valid row':{sum:'sum per group',mean:'average per group',count:'rows per group'}[agg]}`;
 $('legend').textContent=count?'Row count':y||'Value';renderTable();draw(points,type,x,count?'Row count':y);summary(points,type,x,y,agg)
}
function renderTable(){let size=6,max=Math.max(0,Math.ceil(filtered.length/size)-1);page=Math.min(page,max);$('thead').replaceChildren();let tr=document.createElement('tr');for(let c of columns){let th=document.createElement('th');th.textContent=c;tr.append(th)}$('thead').append(tr);$('tbody').replaceChildren();for(let r of filtered.slice(page*size,page*size+size)){let tr=document.createElement('tr');for(let c of columns){let td=document.createElement('td');td.textContent=r[c];td.title=String(r[c]);tr.append(td)}$('tbody').append(tr)}$('tablecaption').textContent=`${filtered.length} matching rows · select columns in the controls to update the chart.`;$('pageinfo').textContent=filtered.length?`Rows ${page*size+1}–${Math.min((page+1)*size,filtered.length)} of ${filtered.length}`:'No matching rows';$('prev').disabled=page===0;$('next').disabled=page===max}
function draw(all,type,xname,yname){
 if(!all.length){$('chart').innerHTML='<div class="empty">No plottable values in this view.<br>Choose another column or clear your filter.</div>';lastsvg='';$('export').disabled=true;return}
 const limit=type==='scatter'?1000:80,p=all.slice(0,limit),W=900,H=370,L=80,R=35,T=22,B=80,w=W-L-R,h=H-T-B,values=p.map(d=>d.y);
 const lo=Math.min(0,...values),hi=Math.max(0,...values),span=hi-lo||1,y=v=>T+h-(v-lo)/span*h;
 let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="svgtitle"><title id="svgtitle">${esc($('charttitle').textContent)}</title><rect width="900" height="370" fill="white"/>`;
 for(let i=0;i<=4;i++){let v=lo+span*i/4,yy=y(v);s+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#e7edf0"/><text x="${L-12}" y="${yy+4}" font-size="11" text-anchor="end" fill="#7a8991">${esc(fmt(v))}</text>`}
 s+=`<line x1="${L}" x2="${W-R}" y1="${y(0)}" y2="${y(0)}" stroke="#b9c9cf"/><text x="${L+w/2}" y="${H-8}" font-size="11" text-anchor="middle" fill="#657883">${esc(xname)}</text><text transform="translate(17 ${T+h/2}) rotate(-90)" font-size="11" text-anchor="middle" fill="#657883">${esc(yname)}</text>`;
 const info=d=>`${d.label}\n${xname}${type==='scatter'?': '+fmt(d.x):': '+d.label}\n${yname}: ${fmt(d.y)}${type==='scatter'?'':'\nRows used: '+d.n}`;
 const attrs=d=>`class="point" tabindex="0" role="graphics-symbol" aria-label="${esc(info(d))}" data-tip="${esc(info(d))}"`;
 if(type==='scatter'){
 let xmin=Math.min(...p.map(d=>d.x)),xmax=Math.max(...p.map(d=>d.x)),range=xmax-xmin||1;if(xmax===xmin){xmin-=.5;range=1}let xx=v=>L+(v-xmin)/range*w;
 for(let i=0;i<=4;i++){let v=xmin+range*i/4;s+=`<text x="${xx(v)}" y="${T+h+22}" text-anchor="middle" font-size="11" fill="#7a8991">${esc(fmt(v))}</text>`}
 for(let d of p)s+=`<circle ${attrs(d)} cx="${xx(d.x)}" cy="${y(d.y)}" r="5" fill="#087f75" opacity=".72"/>`;
 }else{
 let band=w/p.length,xx=i=>L+band*(i+.5);
 if(type==='line')s+=`<polyline points="${p.map((d,i)=>xx(i)+','+y(d.y)).join(' ')}" fill="none" stroke="#087f75" stroke-width="3"/>`;
 p.forEach((d,i)=>{if(type==='bar')s+=`<rect ${attrs(d)} x="${xx(i)-band*.31}" y="${Math.min(y(0),y(d.y))}" width="${Math.max(1,band*.62)}" height="${Math.max(.8,Math.abs(y(0)-y(d.y)))}" rx="3" fill="${i===p.length-1?'#e69757':'#087f75'}"/>`;else s+=`<circle ${attrs(d)} cx="${xx(i)}" cy="${y(d.y)}" r="4" fill="#087f75" stroke="white" stroke-width="2"/>`;
 if(i%Math.max(1,Math.ceil(p.length/12))===0){let label=d.label.length>14?d.label.slice(0,12)+'…':d.label;s+=`<text transform="translate(${xx(i)} ${T+h+19}) rotate(-25)" text-anchor="end" font-size="10" fill="#7a8991">${esc(label)}</text>`}})
 }
 s+='</svg>';$('chart').innerHTML=s;lastsvg=s;$('export').disabled=false;
 for(let el of $('chart').querySelectorAll('.point')){let show=e=>{let rect=el.getBoundingClientRect();$('tooltip').textContent=el.dataset.tip;$('tooltip').hidden=false;$('tooltip').style.left=Math.max(6,Math.min(innerWidth-255,e.clientX??rect.left))+'px';$('tooltip').style.top=Math.max(6,Math.min(innerHeight-105,(e.clientY??rect.top)-70))+'px'};el.addEventListener('pointermove',show);el.addEventListener('focus',show);el.addEventListener('pointerleave',()=>$('tooltip').hidden=true);el.addEventListener('blur',()=>$('tooltip').hidden=true)}
 if(all.length>limit)notify(`Showing the first ${limit} ${type==='scatter'?'valid points':'groups'} of ${all.length}. Filter the data for a more focused view. The table includes all matching rows.`);else if($('notice').textContent.startsWith('Showing the first'))notify('')
}
function summary(p,type,x,y,agg){if(!p.length){$('insight').textContent='No numeric values match this view. For a text-only dataset, select Count rows; otherwise choose a numeric value column.';return}if(type==='scatter'){$('insight').textContent=`This view plots ${fmt(p.length)} valid pairs of ${x} and ${y}. Each point is a row. Point patterns describe association; they do not establish causation.`;return}let top=p.reduce((a,b)=>b.y>a.y?b:a),bottom=p.reduce((a,b)=>b.y<a.y?b:a);$('insight').textContent=`Across ${fmt(p.length)} groups, ${top.label} has the highest ${agg==='count'?'row count':agg+' of '+y} (${fmt(top.y)}), while ${bottom.label} has the lowest (${fmt(bottom.y)}). ${agg==='count'?'Counts include every matching row.':'Blank or nonnumeric values are excluded from this calculation.'}`}
async function upload(file){if(!file)return;const version=++uploadVersion;try{if(file.size>5*1024*1024)throw Error('This file is over 5 MB. Please use a smaller dataset.');let text=await file.text();if(version!==uploadVersion)return;let data=/\.json$/i.test(file.name)?parseJSON(text):parseCSV(text);load(data,file.name)}catch(e){if(version===uploadVersion)notify(e.message,true)}finally{$('file').value=''}}
function save(text,name,type){let url=URL.createObjectURL(new Blob([text],{type}));let a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('file').addEventListener('change',e=>upload(e.target.files[0]));$('drop').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('file').click()}});
for(let ev of ['dragenter','dragover'])$('drop').addEventListener(ev,e=>{e.preventDefault();$('drop').classList.add('drag')});for(let ev of ['dragleave','drop'])$('drop').addEventListener(ev,e=>{e.preventDefault();$('drop').classList.remove('drag');if(ev==='drop')upload(e.dataTransfer.files[0])});
$('sample').onclick=()=>{uploadVersion++;load(parseCSV(sampleCSV),'Sample operations.csv',true)};$('download').onclick=()=>save(sampleCSV,'sample-operations.csv','text/csv');$('paste').onclick=()=>{$('pasteDialog').showModal();$('csvtext').focus()};$('loadpaste').onclick=()=>{try{load(parseCSV($('csvtext').value),'Pasted data.csv');uploadVersion++;$('pasteDialog').close()}catch(e){notify(e.message,true);$('pasteDialog').close()}};
$('type').onchange=()=>{setupFields();page=0;render()};for(let id of ['x','y','aggregation'])$(id).onchange=()=>{setupFields();page=0;render()};$('filter').oninput=()=>{page=0;render()};$('prev').onclick=()=>{page--;renderTable()};$('next').onclick=()=>{page++;renderTable()};$('reset').onclick=()=>{$('filter').value='';$('type').value='bar';$('aggregation').value=numeric.length?'sum':'count';options($('x'),columns,columns[0]);options($('y'),numeric,numeric[0]);page=0;setupFields();notify('');render()};$('export').onclick=()=>save(lastsvg,'data-visualization.svg','image/svg+xml');
load(parseCSV(sampleCSV),'Sample operations.csv',true);
