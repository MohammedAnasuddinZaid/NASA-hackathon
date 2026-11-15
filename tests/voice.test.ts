import {afterEach,describe,expect,it,vi} from 'vitest';
import {apiHealth,apiVoiceTurn} from '../src/lib/api';
import {bundledCorpusVersion} from '../src/lib/datasetIdentity';
import {answerToText,ask} from '../src/lib/assistant';
afterEach(()=>vi.unstubAllGlobals());
describe('optional combined voice boundary',()=>{
 for(const [name,status,body,reason] of [
  ['standalone backend',404,{},'evidence_only'],['unavailable combined backend',503,{},'not_configured'],
  ['missing models',200,{corpus_version:bundledCorpusVersion,voice:{available:false,reason:'private path'}},'not_configured'],
  ['different dataset',200,{corpus_version:'stale',voice:{available:true}},'corpus_mismatch'],
 ] as const)it(name,async()=>{vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})));expect(await apiHealth()).toEqual({available:false,reason});});
 it('enables only compatible configured voice',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({corpus_version:bundledCorpusVersion,voice:{available:true}}),{headers:{'Content-Type':'application/json'}})));expect((await apiHealth()).available).toBe(true);});
 it('does not expose server failures as a raw HTTP status or private path',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>new Response('secret /private/model',{status:503})));await expect(apiVoiceTurn('B1')).rejects.toThrow('Voice is unavailable');});
 it('copied generated interpretations preserve the mode instead of claiming no model call',()=>{const text=answerToText(ask('What oxygen did BASS2-B1 report?'),{notice:'AI interpretation generated; claims remain deterministic.',interpretation:'An explanation of cited evidence.',model:'mock-provider-not-live'});expect(text).toContain('AI interpretation (mock-provider-not-live)');expect(text).toContain('22.2');expect(text).not.toContain('No external model was called');});
});
