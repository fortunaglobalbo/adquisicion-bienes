const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const resolve=Module._resolveFilename;Module._resolveFilename=function(name,...args){return resolve.call(this,name.startsWith('@/')?path.join(process.cwd(),'src',name.slice(2)):name,...args)};
process.env.OPENCODE_GO_API_KEY='mock-not-a-real-credential';
const native={setTimeout:global.setTimeout,clearTimeout:global.clearTimeout,performance:global.performance,now:Date.now,fetch:global.fetch,warn:console.warn};
let clock=0,calls=[],delays=[],realDelay=false;
Object.defineProperty(global,'performance',{value:{now:()=>clock},configurable:true});
Date.now=()=>Date.UTC(2026,9,20)+clock;
global.setTimeout=(callback,delay,...args)=>{delays.push(delay);if(realDelay)return native.setTimeout(callback,delay,...args);clock+=delay;queueMicrotask(()=>callback(...args));return {mock:true};};
global.clearTimeout=timer=>{if(!timer?.mock)native.clearTimeout(timer);};
console.warn=()=>{};
const {callOpenCodeGo}=require('../src/lib/ai/openCodeClient.ts');
const success=()=>new Response(JSON.stringify({choices:[{message:{content:'{"ok":true}'},finish_reason:'stop'}]}),{status:200});
const failure=(status,body={},headers={})=>new Response(JSON.stringify(body),{status,headers});
function setup(sequence){clock=0;calls=[];delays=[];realDelay=false;global.fetch=async(url,options)=>{calls.push({url,options});const value=sequence[Math.min(calls.length-1,sequence.length-1)];if(typeof value==='function')return value(options);if(value instanceof Error)throw value;return value;};}
const invoke=(timeout=10000,signal,session)=>callOpenCodeGo([{role:'user',content:'Solo datos de prueba.'}],0.1,100,timeout,session,{strict:true,signal});
async function main(){
 const configuredBase=process.env.OPENCODE_GO_BASE_URL,configuredModel=process.env.OPENCODE_GO_MODEL;
 delete process.env.OPENCODE_GO_BASE_URL;delete process.env.OPENCODE_GO_MODEL;
 setup([success()]);await invoke();assert.equal(calls[0].url,'https://opencode.ai/inference/go/anthropic/v1/messages','El valor predeterminado debe permanecer en el plan Go');assert.equal(JSON.parse(calls[0].options.body).model,'claude-haiku-5-5');
 process.env.OPENCODE_GO_BASE_URL='https://go-proxy.invalid/custom';process.env.OPENCODE_GO_MODEL='chosen-model';setup([success()]);await invoke();assert.equal(calls[0].url,'https://go-proxy.invalid/custom/chat/completions');assert.equal(JSON.parse(calls[0].options.body).model,'chosen-model','Respetar una configuración explícita sin cambiar de modelo automáticamente');
 if(configuredBase===undefined)delete process.env.OPENCODE_GO_BASE_URL;else process.env.OPENCODE_GO_BASE_URL=configuredBase;if(configuredModel===undefined)delete process.env.OPENCODE_GO_MODEL;else process.env.OPENCODE_GO_MODEL=configuredModel;
 for(const status of [500,502,503,504,408]){setup([failure(status),success()]);assert.equal(await invoke(),'{"ok":true}');assert.equal(calls.length,2);assert.deepEqual(delays,[1500]);assert.equal(calls[0].options.headers['x-opencode-session'],calls[1].options.headers['x-opencode-session'],'La sesión generada permanece estable');assert.equal(calls[0].options.signal,calls[1].options.signal,'Se comparte el presupuesto total entre intentos');}
 setup([new TypeError('fetch failed'),success()]);assert.equal(await invoke(),'{"ok":true}');assert.equal(calls.length,2);
 setup([new Response('{"choices":',{status:200}),success()]);assert.equal(await invoke(),'{"ok":true}');assert.equal(calls.length,2);
 setup([failure(429,{error:{code:'rate_limit'}},{'retry-after':'2'}),success()]);assert.equal(await invoke(),'{"ok":true}');assert.equal(calls.length,2);assert.deepEqual(delays,[2000]);
 setup([failure(429,{error:{code:'rate_limit'}},{'retry-after':new Date(Date.UTC(2026,9,20)+3000).toUTCString()}),success()]);assert.equal(await invoke(),'{"ok":true}');assert.deepEqual(delays,[3000]);
 for(const [body,headers] of [[{error:{code:'insufficient_quota'}},{'retry-after':'2'}],[{error:{message:'Monthly usage_limit exhausted'}},{'retry-after':'1'}],[{errorCode:'monthly_limit'},{'retry-after':'1'}],[{},{}],[{error:{code:'rate_limit'}},{'retry-after':'30'}],[{}, {'retry-after':'nonsense'}]]){setup([failure(429,body,headers),success()]);await assert.rejects(()=>invoke(),error=>error.code==='rate_limit');assert.equal(calls.length,1,'Cuota, plazo largo o Retry-After ausente no se repiten');}
 for(const status of [400,401,403,404,413,422]){setup([failure(status),success()]);await assert.rejects(()=>invoke(),error=>error.code==='rejected');assert.equal(calls.length,1,'No reintentar rechazo de credencial o solicitud');}
 setup([failure(401,{error:{code:'api_key_expired',message:'DO_NOT_ECHO_SECRET'}}),success()]);await assert.rejects(()=>invoke(),error=>error.code==='rejected'&&/credencial.*venció.*HTTP 401/.test(error.message)&&!error.message.includes('DO_NOT_ECHO_SECRET'));assert.equal(calls.length,1);
 setup([failure(410,{error:{type:'ModelDeprecated',message:'DO_NOT_ECHO_SECRET'}}),success()]);await assert.rejects(()=>invoke(),error=>error.code==='rejected'&&/modelo.*retirado.*borrador se conserva/.test(error.message)&&!error.message.includes('DO_NOT_ECHO_SECRET'));assert.equal(calls.length,1,'Un modelo retirado requiere configuración, no reintentos');
 setup([failure(400,{error:{message:'Upstream request failed: This Go model requires Global regions. DO_NOT_ECHO_SECRET'}}),success()]);await assert.rejects(()=>invoke(),error=>error.code==='rejected'&&/regiones.*privacidad.*borrador se conserva/.test(error.message)&&!error.message.includes('DO_NOT_ECHO_SECRET'));assert.equal(calls.length,1,'Una restricción de privacidad no puede eludirse ni provocar un cambio de proveedor');
 setup([new Response(JSON.stringify({choices:[{message:{content:'{"ok":'},finish_reason:'length'}]}),{status:200}),success()]);await assert.rejects(()=>invoke(),error=>error.code==='incomplete');assert.equal(calls.length,1,'No usar ni repetir una respuesta semánticamente truncada');
 setup([new Response(JSON.stringify({choices:[{message:{content:''},finish_reason:'stop'}]}),{status:200}),success()]);assert.equal(await invoke(),'{"ok":true}');assert.equal(calls.length,2);
 setup([new Response('null',{status:200}),success()]);assert.equal(await invoke(),'{"ok":true}');assert.equal(calls.length,2);
 setup([failure(503),failure(503),success()]);await assert.rejects(()=>invoke(),error=>error.code==='unavailable');assert.equal(calls.length,2,'Máximo dos intentos');
 setup([()=>{clock+=1000;return failure(503);},success()]);await assert.rejects(()=>invoke(2000),error=>error.code==='unavailable');assert.equal(calls.length,1);assert.deepEqual(delays,[],'No esperar ni renovar el plazo si el resto del presupuesto no permite otro intento');
 setup([()=>{clock+=3000;throw new TypeError('fetch failed');},success()]);await assert.rejects(()=>invoke(2000),error=>error.code==='timeout');assert.equal(calls.length,1);
 setup([failure(503),()=>{clock+=3000;return success();}]);await assert.rejects(()=>invoke(4000),error=>error.code==='timeout');assert.equal(calls.length,2);assert.equal(clock,4500,'El segundo intento no recibe un nuevo presupuesto de cuatro segundos');
 setup([new DOMException('timeout','TimeoutError'),success()]);await assert.rejects(()=>invoke(),error=>error.code==='timeout');assert.equal(calls.length,1);
 setup([failure(429,{}, {'retry-after':'2'}),success()]);await assert.rejects(()=>invoke(1000),error=>error.code==='rate_limit');assert.equal(calls.length,1);
 setup([failure(503),success()]);const before=new AbortController();before.abort();await assert.rejects(()=>invoke(10000,before.signal),error=>error.code==='cancelled');assert.equal(calls.length,0);
 setup([failure(503),success()]);realDelay=true;const controller=new AbortController();const start=native.performance.now();const pending=invoke(10000,controller.signal,'stable-request');native.setTimeout(()=>controller.abort(),10);await assert.rejects(()=>pending,error=>error.code==='cancelled');assert.ok(native.performance.now()-start<100,'La cancelación debe interrumpir la espera sin aguardar 1.5 segundos');assert.equal(calls.length,1);
 console.log('PASS recuperación acotada 500/502/503/504/408/red/JSON/vacío, Retry-After breve sin cuota, credencial vencida/no acceso sin reintento, cancelación inmediata, sesión y presupuesto total estables, truncado rechazado y máximo dos intentos; todo simulado sin red.');
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;}).finally(()=>{global.setTimeout=native.setTimeout;global.clearTimeout=native.clearTimeout;Object.defineProperty(global,'performance',{value:native.performance,configurable:true});Date.now=native.now;global.fetch=native.fetch;console.warn=native.warn;});
