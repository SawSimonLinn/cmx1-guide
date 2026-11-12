import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { parseNoteInput } from '@/lib/notes';
import { configuredProvider, generateInspectionNote } from '@/lib/server/note-provider';
import { configuredTrainingGenerator, generateTraining, parseTrainingRequest } from '@/lib/server/training-provider';
export const runtime='nodejs';
const buckets=new Map<string,{count:number;until:number}>();
export async function POST(request:NextRequest) {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return NextResponse.json({error:'Authentication is not configured.'},{status:503});
  const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if(!token)return NextResponse.json({error:'Sign in to generate a note.'},{status:401});
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  let userId:string;
  try {
    const {data,error}=await client.auth.getUser(token);
    if(error||!data.user)return NextResponse.json({error:'Your session has expired. Sign in again.'},{status:401});
    userId=data.user.id;
  }catch {return NextResponse.json({error:'Unable to verify your session.'},{status:503});}
  const now=Date.now();
  for(const [id,bucket]of buckets)if(bucket.until<now)buckets.delete(id);
  const bucket=buckets.get(userId)||{count:0,until:now+60000};
  if(bucket.count>=20)return NextResponse.json({error:'Please wait a minute before generating more notes.'},{status:429,headers:{'Retry-After':'60'}});
  bucket.count++;buckets.set(userId,bucket);
  try {
    // Check the actual bytes, not just a client-controlled Content-Length header.
    const reader=request.body?.getReader();let size=0,body='';const decoder=new TextDecoder();
    if(!reader)return NextResponse.json({error:'Inspection data is required.'},{status:400});
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1000000){await reader.cancel();return NextResponse.json({error:'Inspection data is too large.'},{status:413});}body+=decoder.decode(value,{stream:true});}
    body+=decoder.decode();
    const parsed=JSON.parse(body);
    if(parsed?.kind==='training'||parsed?.kind==='training_issue'){
      const result=await generateTraining(parseTrainingRequest(parsed),configuredTrainingGenerator());
      return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
    }
    if(size>20000)return NextResponse.json({error:'Inspection data is too large.'},{status:413});
    const input=parseNoteInput(parsed);
    const note=await generateInspectionNote(input,configuredProvider());
    return NextResponse.json(note,{headers:{'Cache-Control':'no-store'}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Invalid inspection data.'},{status:400});}
}
