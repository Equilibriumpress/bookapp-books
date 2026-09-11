import { PublicationBook, ValidationIssue } from "./model.js";

export function validatePublication(book: PublicationBook): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const orders = new Map<number,string[]>();
  if (!book.title.trim()) issues.push(err("book-title","Book title is missing."));
  if (!book.coverMediaId) issues.push(err("cover","Book cover media is missing."));
  if (!book.pages.length) issues.push(err("pages","Book has no published pages."));
  for (const page of book.pages) {
    const list=orders.get(page.order)??[]; list.push(page.id); orders.set(page.order,list);
    if(!page.name.trim()) issues.push(err("page-title","Page title is missing.",page.id));
    if(page.order<=0) issues.push(err("page-order","Page order must be greater than zero.",page.id));
  }
  for(const [order,ids] of orders) if(ids.length>1) issues.push(err("duplicate-order",`Order ${order} is used by ${ids.join(", ")}.`));
  const referenced=new Set<string>(); if(book.coverMediaId) referenced.add(book.coverMediaId);
  for(const page of book.pages){if(page.primaryMediaId)referenced.add(page.primaryMediaId);page.mediaIds.forEach((id)=>referenced.add(id));page.componentIds.flatMap((id)=>book.components[id]?.mediaIds??[]).forEach((id)=>referenced.add(id));}
  for(const id of referenced){const m=book.media[id];if(!m){issues.push(err("media-missing",`Referenced media '${id}' is missing.`,undefined,id));continue;}if(["Image","Map"].includes(m.type)&&!m.externalUrl&&!m.permanentUrl)issues.push(err("media-url",`Media '${m.name}' has no downloadable URL.`,undefined,id));if(m.type==="Image"&&!m.altText.trim())issues.push(warn("alt-text",`Image '${m.name}' has no alt text.`,undefined,id));if(!m.rightsVerified)issues.push(warn("rights",`Rights are not verified for '${m.name}'.`,undefined,id));if(m.type==="Map"&&!m.externalUrl&&!m.permanentUrl)issues.push(err("map-preview",`Map '${m.name}' has no static preview image.`,undefined,id));}
  return issues;
}
function err(code:string,message:string,pageId?:string,mediaId?:string):ValidationIssue{return{severity:"error",code,message,pageId,mediaId};}
function warn(code:string,message:string,pageId?:string,mediaId?:string):ValidationIssue{return{severity:"warning",code,message,pageId,mediaId};}
