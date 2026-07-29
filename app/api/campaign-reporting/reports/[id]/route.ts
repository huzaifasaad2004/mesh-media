import { NextRequest, NextResponse } from 'next/server'
import { MANAGERS, requireRoles, serviceRole } from '@/lib/apiAuth'

export async function PATCH(req:NextRequest,{params}:{params:{id:string}}){const auth=await requireRoles(MANAGERS);if('res'in auth)return auth.res;const body=await req.json();const allowed:any={};for(const k of ['status','internal_notes'])if(body[k]!==undefined)allowed[k]=body[k];if(body.status==='approved'){allowed.approved_by=auth.user.id;allowed.approved_at=new Date().toISOString()}const{data,error}=await serviceRole().from('campaign_reports').update(allowed).eq('id',params.id).select().single();return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data)}
