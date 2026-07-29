import { NextResponse } from 'next/server'
import { serviceRole } from '@/lib/apiAuth'

export async function GET(_:Request,{params}:{params:{token:string}}){
  const db=serviceRole(),{data:r}=await db.from('campaign_reports').select('audio_storage_path,public_expires_at').eq('public_token',params.token).maybeSingle()
  if(!r?.audio_storage_path||r.public_expires_at&&new Date(r.public_expires_at)<new Date())return NextResponse.json({error:'Voice briefing unavailable'},{status:404})
  const{data,error}=await db.storage.from('campaign-reports').download(r.audio_storage_path)
  if(error)return NextResponse.json({error:error.message},{status:400})
  const extension=r.audio_storage_path.split('.').pop(),type=extension==='m4a'?'audio/mp4':extension==='mp3'?'audio/mpeg':'audio/webm'
  return new NextResponse(new Uint8Array(await data.arrayBuffer()),{headers:{'Content-Type':type,'Cache-Control':'private, max-age=3600'}})
}
