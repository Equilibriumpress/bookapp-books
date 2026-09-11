import { PublicationBook, PublicationComponent, PublicationMedia, PublicationPage } from "./model.js";

const NOTION_VERSION = "2025-09-03";
const DATA_SOURCES = {
  books: "89e2d0cb-9451-4328-b326-df1596129984",
  pages: "ea293763-b839-4e00-ac7b-b4c253ae4749",
  components: "b2ac592e-36c1-4281-8d09-a31a821b59f7",
  media: "0c37dd9a-bba5-432f-bb8c-1dd3aed9cf40"
} as const;
type Json = Record<string, any>;

export async function fetchPublication(slug: string): Promise<PublicationBook> {
  const token = requiredEnv("NOTION_API_KEY");
  const [books, pages, components, media] = await Promise.all([
    queryPublished(DATA_SOURCES.books, token), queryPublished(DATA_SOURCES.pages, token),
    queryPublished(DATA_SOURCES.components, token), queryPublished(DATA_SOURCES.media, token)
  ]);
  const bookPage = books.find((p) => text(p, "Slug") === slug);
  if (!bookPage) throw new Error(`Published Notion book not found: ${slug}`);
  const bookNotionId = normalizeId(bookPage.id);
  const relatedPages = pages.filter((p) => relation(p, "Book").some((id) => normalizeId(id) === bookNotionId)).sort((a,b)=>number(a,"Order")-number(b,"Order"));
  const pageNotionIds = new Set(relatedPages.map((p)=>normalizeId(p.id)));
  const relatedMedia = media.filter((m) => relation(m, "Book").some((id)=>normalizeId(id)===bookNotionId));
  const normalizedMedia: Record<string, PublicationMedia> = {};
  for (const item of relatedMedia) {
    const id = text(item,"Media ID") || normalizeId(item.id);
    normalizedMedia[id] = normalizeMedia(item,id,relatedMedia);
  }
  const normalizedComponents: Record<string, PublicationComponent> = {};
  for (const component of components.filter((c)=>relation(c,"Page").some((id)=>pageNotionIds.has(normalizeId(id))))) {
    const id = normalizeId(component.id);
    normalizedComponents[id] = {
      id, notionPageId:id, type:select(component,"Component type"), slot:select(component,"Slot"), order:number(component,"Order"),
      label:text(component,"Label"), title:text(component,"Title"), body:text(component,"Body"), value:text(component,"Value"),
      secondaryValue:text(component,"Secondary value"), listStyle:select(component,"List style"), style:select(component,"Style"),
      linkUrl:url(component,"Link URL") || undefined, linkLabel:text(component,"Link label"), pageIds:relation(component,"Page").map(normalizeId),
      mediaIds:relation(component,"Media").map((v)=>resolveMediaId(v,relatedMedia)).filter((v): v is string => Boolean(v))
    };
  }
  const normalizedPages: PublicationPage[] = [];
  for (const page of relatedPages) {
    const pageId = text(page,"Page ID") || normalizeId(page.id);
    const notionPageId = normalizeId(page.id);
    normalizedPages.push({
      id:pageId, notionPageId, name:title(page,"Name"), order:number(page,"Order"), template:select(page,"Page template") || "standard-guide",
      eyebrow:text(page,"Eyebrow"), deck:text(page,"Deck"), sectionId:relation(page,"Section")[0] ? normalizeId(relation(page,"Section")[0]) : undefined,
      showInTOC:checkbox(page,"Show in TOC"), tocTitle:text(page,"TOC title") || undefined, tocSubtitle:text(page,"TOC subtitle") || undefined,
      primaryMediaId:resolveMediaId(relation(page,"Primary media")[0],relatedMedia),
      mediaIds:relation(page,"Media").map((v)=>resolveMediaId(v,relatedMedia)).filter((v): v is string => Boolean(v)),
      componentIds:Object.values(normalizedComponents).filter((c)=>c.pageIds.includes(notionPageId)).sort((a,b)=>a.order-b.order).map((c)=>c.id),
      bodyHtml: checkbox(page,"Render body") ? await fetchPageBodyHtml(page.id,token) : ""
    });
  }
  return {
    id:slug, notionPageId:bookNotionId, title:title(bookPage,"Name"), subtitle:text(bookPage,"Subtitle"), author:text(bookPage,"Author") || "Equilibrium Press",
    language:select(bookPage,"Language") || "en", version:Math.max(1,number(bookPage,"Content version")), theme:select(bookPage,"Theme") || "field-guide",
    profile: inferProfile(select(bookPage,"Theme"), select(bookPage,"Book type")),
    coverMediaId:resolveMediaId(relation(bookPage,"Cover media")[0],relatedMedia), pages:normalizedPages, media:normalizedMedia, components:normalizedComponents
  };
}

async function queryPublished(id:string, token:string):Promise<Json[]> {
  const out:Json[]=[]; let cursor:string|undefined;
  do { const r=await notion(`/v1/data_sources/${id}/query`,token,{method:"POST",body:JSON.stringify({page_size:100,filter:{property:"Status",status:{equals:"Published"}},...(cursor?{start_cursor:cursor}:{})})}); out.push(...r.results); cursor=r.has_more?r.next_cursor:undefined; } while(cursor);
  return out;
}
async function fetchPageBodyHtml(pageId:string, token:string):Promise<string> {
  const blocks:Json[]=[]; let cursor:string|undefined;
  do { const q=new URLSearchParams({page_size:"100"}); if(cursor) q.set("start_cursor",cursor); const r=await notion(`/v1/blocks/${pageId}/children?${q}`,token); blocks.push(...r.results); cursor=r.has_more?r.next_cursor:undefined; } while(cursor);
  return blocks.map(renderBlock).join("\n");
}
function renderBlock(block:Json):string { const value=block[block.type]??{}; const content=richText(value.rich_text??[]); switch(block.type){case"paragraph":return content?`<p>${content}</p>`:"";case"heading_1":return`<h1>${content}</h1>`;case"heading_2":return`<h2>${content}</h2>`;case"heading_3":return`<h3>${content}</h3>`;case"quote":return`<blockquote>${content}</blockquote>`;case"callout":return`<aside>${content}</aside>`;case"bulleted_list_item":return`<ul><li>${content}</li></ul>`;case"numbered_list_item":return`<ol><li>${content}</li></ol>`;case"divider":return"<hr />";default:return content?`<p>${content}</p>`:"";} }
function richText(items:Json[]):string { return items.map((i)=>{const plain=esc(i.plain_text??i.text?.content??""); const a=i.annotations??{}; let v=i.href?`<a href="${escAttr(i.href)}">${plain}</a>`:plain; if(a.code)v=`<code>${v}</code>`; if(a.bold)v=`<strong>${v}</strong>`; if(a.italic)v=`<em>${v}</em>`; if(a.strikethrough)v=`<s>${v}</s>`; if(a.underline)v=`<u>${v}</u>`; return v;}).join(""); }
function normalizeMedia(page:Json,id:string,all:Json[]):PublicationMedia { return {id,notionPageId:normalizeId(page.id),name:title(page,"Name"),type:select(page,"Type"),externalUrl:url(page,"External URL")||fileUrl(page,"File")||undefined,permanentUrl:url(page,"Permanent URL")||undefined,sourceUrl:url(page,"Source URL")||undefined,geoJsonUrl:fileUrl(page,"GeoJSON file")||undefined,previewMediaId:resolveMediaId(relation(page,"Preview media")[0],all),galleryItemIds:relation(page,"Gallery items").map((v)=>resolveMediaId(v,all)).filter((v):v is string=>Boolean(v)),caption:text(page,"Caption"),altText:text(page,"Alt text"),credit:text(page,"Credit"),license:select(page,"License"),licenseUrl:url(page,"License URL")||undefined,rightsVerified:checkbox(page,"Rights verified")}; }
function resolveMediaId(notionId:string|undefined,all:Json[]):string|undefined { if(!notionId)return undefined; const n=normalizeId(notionId); const p=all.find((i)=>normalizeId(i.id)===n); return p?(text(p,"Media ID")||n):undefined; }
function inferProfile(theme:string,bookType:string):"reflowable"|"fixed" { return /(photo|field-guide|premium)/.test(`${theme} ${bookType}`.toLowerCase())?"fixed":"reflowable"; }
async function notion(path:string,token:string,init:RequestInit={}):Promise<Json>{const r=await fetch(`https://api.notion.com${path}`,{...init,headers:{Authorization:`Bearer ${token}`,"Notion-Version":NOTION_VERSION,"Content-Type":"application/json",...(init.headers??{})}});if(!r.ok)throw new Error(`Notion ${r.status}: ${await r.text()}`);return r.json() as Promise<Json>;}
function property(p:Json,n:string):Json{return p.properties?.[n]??{};} function title(p:Json,n:string){return plain(property(p,n).title);} function text(p:Json,n:string){return plain(property(p,n).rich_text);} function select(p:Json,n:string){return property(p,n).select?.name??property(p,n).status?.name??"";} function number(p:Json,n:string){return Number(property(p,n).number??0);} function checkbox(p:Json,n:string){return Boolean(property(p,n).checkbox);} function url(p:Json,n:string){return property(p,n).url??"";} function relation(p:Json,n:string):string[]{return(property(p,n).relation??[]).map((i:Json)=>i.id);} function fileUrl(p:Json,n:string){const i=property(p,n).files?.[0];return i?.file?.url??i?.external?.url??"";} function plain(items:Json[]=[]){return items.map((i)=>i.plain_text??i.text?.content??"").join("");} function normalizeId(v:string){return v.replaceAll("-","").toLowerCase();} function requiredEnv(n:string){const v=process.env[n]?.trim();if(!v)throw new Error(`${n} is required`);return v;} function esc(v:string){return v.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");} function escAttr(v:string){return esc(v).replaceAll('"',"&quot;");}
