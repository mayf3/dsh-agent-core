"""Strict paired protocol projection and actual terminal Owner input transport.
No synthesized COMMIT/ABORT/WITNESSED/CONFIRM or arbitrary request material.
"""
import base64
import copy
import hashlib
import queue
import re
import sys
import threading
import time

EXECUTE='B7_PACKET_EXECUTE_V2';RESUME='B7_PACKET_RESUME_V2';INPUT='B7_OWNER_INPUT_V2';CLOSE='B7_OWNER_EOF_V2';STATUS='DS_B7_EXECUTION_STATUS_V2';OUTPUT='DS_B7_OWNER_OUTPUT_V2'
RECONCILE='B7_PACKET_RECONCILE_V2';RECOVERY='B7_PACKET_RECOVERY_ABORT_V2';DISPOSAL='B7_PACKET_DISPOSAL_V3'
READS={STATUS,OUTPUT}
FIELDS={EXECUTE:{'action','operation_id'},RECOVERY:{'action','operation_id'},RECONCILE:{'action','operation_id'},DISPOSAL:{'action','operation_id'},RESUME:{'action','operation_id','transaction_id'},INPUT:{'action','operation_id','sequence','input_b64'},CLOSE:{'action','operation_id','sequence'},STATUS:{'action','operation_id'},OUTPUT:{'action','operation_id','cursor'}}
OP=re.compile(r'^b7-packet-[A-Za-z0-9._-]{1,118}$');TX=re.compile(r'^tx-[A-Za-z0-9-]{1,100}$');HEX=re.compile(r'^[a-f0-9]{64}$')

def install_execution_client_hooks(client):
 if getattr(client,'_b7_exec_client_installed',False):raise ValueError('B7_EXECUTION_CLIENT_ALREADY_INSTALLED')
 original=client.request;original_validator=client._valid_observation
 client.READ_ACTIONS=client.READ_ACTIONS|READS
 def shape(v,keys):return type(v)is dict and set(v)==set(keys.split())
 def b64(v,maxsize):
  if type(v)is not str or len(v)>maxsize*2:return None
  try:b=base64.b64decode(v,validate=True)
  except (ValueError,TypeError):return None
  return b if len(b)<=maxsize else None
 def request_valid(p):
  a=p.get('action')
  if a not in FIELDS or type(p)is not dict or set(p)!=FIELDS[a] or type(p['operation_id'])is not str or not OP.fullmatch(p['operation_id']):return False
  if a==RESUME:return type(p['transaction_id'])is str and bool(TX.fullmatch(p['transaction_id']))
  if a in (INPUT,CLOSE):
   if type(p['sequence'])is not int or p['sequence']<0:return False
   if a==INPUT:
    b=b64(p['input_b64'],4096);return b is not None and bool(b)
  if a==OUTPUT:return type(p['cursor'])is int and p['cursor']>=0
  return True
 def transport(r,p):
  effect='READ_ONLY' if p['action'] in READS else 'UNKNOWN';nxt='RECHECK_SAME_SUBJECT' if p['action'] in READS else 'QUERY_ORIGINAL_OPERATION'
  if not shape(r,'schema ok observation subject current_runtime_verified replay_allowed error') or not shape(r['error'],'category code stage effect next_action replay_allowed'):return False
  return r=={'schema':'ds-client-transport-v1','ok':False,'observation':'TRANSPORT_UNKNOWN','subject':client._subject(p),'current_runtime_verified':False,'replay_allowed':False,'error':dict(category='TRANSPORT',code=r['error']['code'],stage='transport',effect=effect,next_action=nxt,replay_allowed=False)} and r['error']['code'] in ('TIMEOUT','UNAVAILABLE','INVALID_RESPONSE')
 def dispatcher_error(r,p):
  if not shape(r,'schema ok action observed_at subject observation data current_runtime_verified replay_allowed error') or not shape(r['error'],'category code stage object effect next_action replay_allowed'):return None
  er=r['error'];code=er['code']
  if (type(code)is str and code in client.ERROR_CATEGORIES and er['category']==client.ERROR_CATEGORIES[code] and er['stage'] in ('admission','request','authorize','parse','transport') and er['object']=='request' and er['effect']=='READ_ONLY' and er['next_action']=='RECHECK_SAME_SUBJECT' and er['replay_allowed'] is False and r['schema']=='ds-observation-v1' and r['ok'] is False and r['action'] in (p['action'],None) and r['subject'] in ({},client._subject(p)) and client._timestamp(r['observed_at']) and r['observation']=='UNKNOWN' and r['data']=={} and r['current_runtime_verified'] is False and r['replay_allowed'] is False):return code
  return None
 def valid(r,p):
  a=p['action']
  if not shape(r,'schema ok action operation_id effect replay_allowed current_runtime_verified data error'):return False
  if r['schema']!='ds-b7-execution-v2' or type(r['ok'])is not bool or r['action']!=a or r['operation_id']!=p['operation_id'] or r['effect']!=('READ_ONLY' if a in READS else 'SAME_OPERATION_RETAINED') or r['replay_allowed'] is not False or r['current_runtime_verified'] is not False:return False
  if not r['ok']:
   er=r['error'];return r['data']=={} and shape(er,'code next_action replay_allowed') and type(er['code'])is str and er['code'] in client.ERROR_CATEGORIES and er['next_action']=='INSPECT_SAME_OPERATION' and er['replay_allowed'] is False
  if r['error'] is not None:return False
  d=r['data']
  if a==INPUT:
   b=b64(p['input_b64'],4096)
   return shape(d,'state sequence sha256 already_sent') and d['state']=='INPUT_ACK' and type(d['sequence'])is int and d['sequence']==p['sequence'] and d['sha256']==hashlib.sha256(b).hexdigest() and type(d['already_sent'])is bool
  if a==CLOSE:return shape(d,'state sequence') and d['state']=='OWNER_EOF' and type(d['sequence'])is int and d['sequence']>=0
  if a==OUTPUT:
   if not shape(d,'cursor next_cursor output_b64 active output_available'):return False
   b=b64(d['output_b64'],16384)
   return b is not None and type(d['cursor'])is int and d['cursor']==p['cursor'] and type(d['next_cursor'])is int and d['next_cursor']==d['cursor']+len(b) and type(d['active'])is bool and type(d['output_available'])is bool
  fields='phase tx_id active installed native_state native_terminal_verified loaded_business_proof execution_enabled replay_allowed next_action owner_transport output_available'
  if type(d)is not dict or d.get('phase') not in ('NO_EXECUTION_RECORD','STAGE_INTENT','RUNNING','RETAINED','TERMINAL'):return False
  phase=d['phase']
  if phase!='NO_EXECUTION_RECORD':fields+=' input_sequence input_pending attempt reason'
  if phase=='TERMINAL':fields+=' transaction_sha256'
  d2=dict(d);ov=d2.pop('recovery_terminal',None);dv=d2.pop('disposal_terminal',None)
  E30OP='b7-packet-r27-758d5250f5c352f2e-e30'
  if dv is not None and p['operation_id'] in (E30OP,'b7-packet-r27-2edfbaeef5c352f2e-e31'):
   # AMENDMENT_B7_E30_PARTIAL_STAGE_CLOSURE_V1: the fixed e30 terminal carries
   # the retained partial-stage flag; nothing else about the projection changes.
   if not shape(dv,'native_state installed authorization_sha256 execution_receipt_sha256 partial_stage_preserved') or dv['native_state']!='CLOSED_PRE_TX' or dv['installed'] is not False or dv['partial_stage_preserved'] is not True or not HEX.fullmatch(str(dv['authorization_sha256'])) or not HEX.fullmatch(str(dv['execution_receipt_sha256'])):return False
   if not (phase=='RETAINED' and d.get('tx_id') is None and d.get('attempt')==1 and d.get('input_sequence')==0 and d.get('input_pending') is False and d.get('reason')=='EXECUTION_INTENT' and d.get('next_action')=='COHERENT_CANDIDATE_NEXT'):return False
  elif dv is not None:
   if not shape(dv,'native_state installed authorization_sha256 execution_receipt_sha256') or dv['native_state'] not in ('DISPOSED_PRESEALED','CLOSED_PRE_TX') or dv['installed'] is not False or not HEX.fullmatch(str(dv['authorization_sha256'])) or not HEX.fullmatch(str(dv['execution_receipt_sha256'])):return False
   if dv['native_state']=='CLOSED_PRE_TX' and not (p['operation_id']=='b7-packet-r27-83054332f5c352f2e-e29' and phase=='RETAINED' and d.get('tx_id') is None and d.get('attempt')==1 and d.get('input_sequence')==0 and d.get('input_pending') is False and d.get('reason')=='EXECUTION_INTENT' and d.get('next_action')=='COHERENT_CANDIDATE_NEXT'):return False
  if ov is not None and (not shape(ov,'native_state installed authorization_sha256 original_receipt_sha256') or ov['native_state']!='ABORTED' or ov['installed'] is not False or not HEX.fullmatch(str(ov['authorization_sha256'])) or not HEX.fullmatch(str(ov['original_receipt_sha256']))):return False
  if not shape(d2,fields) or any(type(d2[k])is not bool for k in ('active','native_terminal_verified','loaded_business_proof','execution_enabled','replay_allowed','output_available')) or d2['loaded_business_proof'] is not False or d2['replay_allowed'] is not False or d2['owner_transport']!='ORIGINAL_STDIN_FD3':return False
  if d2['tx_id'] is not None and (type(d2['tx_id'])is not str or not TX.fullmatch(d2['tx_id'])):return False
  if d['next_action'] not in ('INSPECT_ORIGINAL_CUSTODY','INSPECT_ORIGINAL_STAGE_CUSTODY_NO_STAGE_REPLAY','EXPLICIT_SAME_TX_RESUME_OR_NATIVE_DISPOSAL_REVIEW','VERIFY_LOADED_AND_REAL_BUSINESS','COHERENT_CANDIDATE_NEXT'):return False
  if phase!='NO_EXECUTION_RECORD':
   if type(d['input_sequence'])is not int or d['input_sequence']<0 or type(d['input_pending'])is not bool or type(d['attempt'])is not int or d['attempt']<1 or d['reason'] not in ('EXECUTION_INTENT','OWNER_CHANNEL_IDLE_RETAINED','RUN_LIMIT_RETAINED','NATIVE_TERMINAL_VERIFIED'):return False
  if phase=='TERMINAL':return d2['tx_id'] is not None and d2['native_terminal_verified'] is True and d2['native_state'] in ('COMMITTED','ABORTED') and type(d2['installed'])is bool and d2['installed']==(d2['native_state']=='COMMITTED') and type(d2['transaction_sha256'])is str and bool(HEX.fullmatch(d2['transaction_sha256'])) and d2['next_action']=='VERIFY_LOADED_AND_REAL_BUSINESS'
  return (ov is None or ov['native_state']=='ABORTED') and (dv is None or dv['native_state'] in ('DISPOSED_PRESEALED','CLOSED_PRE_TX')) and d2['installed']=='UNKNOWN' and d2['native_state']=='UNKNOWN' and d2['native_terminal_verified'] is False
 def observation(r,p):return (valid(r,p) or dispatcher_error(r,p) is not None) if p.get('action') in READS else original_validator(r,p)
 def ask(p):
  if p.get('action') not in FIELDS:return original(p)
  if not request_valid(p):return client._transport_unknown(p,'INVALID_RESPONSE')
  r=original(p)
  if valid(r,p) or transport(r,p):return r
  code=dispatcher_error(r,p)
  if code:return dict(schema='ds-b7-execution-v2',ok=False,action=p['action'],operation_id=p['operation_id'],effect='READ_ONLY' if p['action'] in READS else 'SAME_OPERATION_RETAINED',replay_allowed=False,current_runtime_verified=False,data={},error=dict(code=code,next_action='INSPECT_SAME_OPERATION',replay_allowed=False))
  return client._transport_unknown(p,'INVALID_RESPONSE')
 client._valid_observation=observation;client.request=ask;client._b7_exec_client_installed=True

def owner_session(client,operation_id,transaction_id=None,stdin=None,stdout=None,launch_action=None):
 """Explicit execution/resume with terminal input only. Transport loss never retries
 stage/input. Status and cursor reads may be repeated; original script decides TX.
 """
 stdin=sys.stdin if stdin is None else stdin;stdout=sys.stdout if stdout is None else stdout
 if not stdin.isatty() or not stdout.isatty():raise ValueError('OWNER_TERMINAL_REQUIRED')
 if not OP.fullmatch(operation_id) or transaction_id is not None and not TX.fullmatch(transaction_id):raise ValueError('INVALID_FIXED_OPERATION')
 launch=dict(action=launch_action or (RESUME if transaction_id else EXECUTE),operation_id=operation_id)
 if transaction_id:launch['transaction_id']=transaction_id
 results=queue.Queue(maxsize=1);lines=queue.Queue(maxsize=1)
 def run():results.put(client.request(launch))
 threading.Thread(target=run,daemon=True).start()
 cursor=0;sequence=0;started=False;reader=None;deadline=time.monotonic()+7200
 def read_owner():
  while True:
   line=stdin.readline(4097)
   lines.put(line)
   if not line:return
 try:
  while time.monotonic()<deadline:
   status=client.request(dict(action=STATUS,operation_id=operation_id))
   if not status.get('ok'):return status
   d=status['data']
   if d['active']:started=True
   output=client.request(dict(action=OUTPUT,operation_id=operation_id,cursor=cursor))
   if not output.get('ok'):return output
   chunk=base64.b64decode(output['data']['output_b64']);cursor=output['data']['next_cursor']
   if chunk:stdout.write(chunk.decode('utf-8',errors='replace'));stdout.flush()
   if d['active'] and reader is None:
    reader=threading.Thread(target=read_owner,daemon=True);reader.start()
   try:line=lines.get_nowait()
   except queue.Empty:line=None
   if line is not None:
    if not line:
     client.request(dict(action=CLOSE,operation_id=operation_id,sequence=sequence));return status
    b=line.encode('utf-8')
    if len(b)>4096:raise ValueError('OWNER_INPUT_TOO_LARGE')
    ack=client.request(dict(action=INPUT,operation_id=operation_id,sequence=sequence,input_b64=base64.b64encode(b).decode()))
    if not ack.get('ok'):return ack  # never resend after ambiguous transport/write
    sequence+=1
   if not d['active'] and len(chunk)<16384 and (started or not results.empty()):return status if started else results.get_nowait()
   time.sleep(.1)
  raise TimeoutError('OWNER_SESSION_LIMIT_SAME_OPERATION_RETAINED')
 finally:
  # Explicit channel closure on operator exit; never a COMMIT/ABORT response.
  if started:client.request(dict(action=CLOSE,operation_id=operation_id,sequence=sequence))

def install_owner_cli(client,policy):
 original=client.main
 pins=copy.deepcopy(policy['packets'])
 fixed=pins['b7-native-execution-r27-new-candidate-uninstallable']
 def main():
  if len(sys.argv)>=2 and sys.argv[1] in ('b7-packet-register-r3','b7-packet-check-r3','b7-status-r3','b7-reconcile-r3'):
   if len(sys.argv)!=3 or not OP.fullmatch(sys.argv[2]):raise SystemExit('B7_FIXED_CLI_USAGE')
   if sys.argv[1] in ('b7-status-r3','b7-reconcile-r3'):payload=dict(action=STATUS if sys.argv[1]=='b7-status-r3' else RECONCILE,operation_id=sys.argv[2])
   else:
    payload=dict(action='B7_PACKET_REGISTER_V1' if sys.argv[1]=='b7-packet-register-r3' else 'DS_B7_PACKET_CHECK_V1',operation_id=sys.argv[2],packet_id='b7-native-execution-r27-new-candidate-uninstallable',manifest_sha256=fixed['manifestSha256'],source_sha256=fixed['sourceSha256'])
   result=client.request(payload);print(__import__('json').dumps(result,sort_keys=True));raise SystemExit(0 if result.get('ok') else 1)
  if len(sys.argv)>=2 and sys.argv[1]=='b7-owner-recovery-abort-v2':
   if len(sys.argv)!=3 or not OP.fullmatch(sys.argv[2]):raise SystemExit('B7_OWNER_USAGE')
   result=owner_session(client,sys.argv[2],launch_action=RECOVERY)
   print(__import__('json').dumps(result,sort_keys=True));raise SystemExit(0 if result.get('ok') and (result.get('data',{}).get('recovery_terminal') or result.get('data',{}).get('native_terminal_verified')) else 1)
  if len(sys.argv)>=2 and sys.argv[1]=='b7-owner-disposal-v3':
   if len(sys.argv)!=3 or not OP.fullmatch(sys.argv[2]):raise SystemExit('B7_OWNER_USAGE')
   result=owner_session(client,sys.argv[2],launch_action=DISPOSAL)
   print(__import__('json').dumps(result,sort_keys=True));raise SystemExit(0 if result.get('ok') and (result.get('data',{}).get('disposal_terminal') or result.get('data',{}).get('native_terminal_verified')) else 1)
  if len(sys.argv)>=2 and sys.argv[1] in ('b7-owner-execute-v2','b7-owner-resume-v2'):
   resume=sys.argv[1]=='b7-owner-resume-v2'
   if len(sys.argv)!=(4 if resume else 3):raise SystemExit('B7_OWNER_USAGE')
   result=owner_session(client,sys.argv[2],sys.argv[3] if resume else None)
   # Output here is only strict status/error projection, not native private records.
   print(__import__('json').dumps(result,sort_keys=True));raise SystemExit(0 if result.get('ok') and result.get('data',{}).get('native_terminal_verified') else 1)
  return original()
 client.main=main
