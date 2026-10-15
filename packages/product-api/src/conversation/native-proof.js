/** Read only the original Router operation; never an admission/retry surface. */
export function originalNativeProof(row,router) {
  let proof
  try {
    proof=row.reconciliation_handle
      ? router.getTurnReconciliation?.(row.reconciliation_handle)
      : router.resolveCallerCorrelation?.({requestId:row.native_request_id})
  } catch {
    return {facts:{execution_status:'unknown',reply_status:'unknown',native_reconciliation_state:'unavailable',
      error_class:'UPSTREAM_UNAVAILABLE'},read_failed:true}
  }
  if(!proof)return {facts:{}}
  const snapshot=proof.snapshot
  if(!snapshot){
    if(['evicted','restart_lost'].includes(proof.state))return {facts:{execution_status:'unknown',reply_status:'unknown',
      native_reconciliation_state:proof.state,error_class:'OUTCOME_UNKNOWN'}}
    return {facts:{native_reconciliation_state:proof.state??'unknown'},pending:['pending','recovering'].includes(proof.state)}
  }
  if(snapshot.agentId!==row.agent_id||snapshot.sessionId!=='main'
    ||(row.message_id!==null&&snapshot.messageId!==row.message_id)
    ||(snapshot.callerCorrelation?.requestId!==undefined&&snapshot.callerCorrelation.requestId!==row.native_request_id)){
    return {facts:{execution_status:'unknown',reply_status:'unknown',native_reconciliation_state:'coordinate_mismatch',
      error_class:'RESULT_UNRECOVERABLE'}}
  }
  const outcome=snapshot.lateOutcome??snapshot.outcome??snapshot.initialOutcome??null
  const facts={native_reconciliation_state:proof.state??'unknown',native_outcome:outcome,
    native_termination_evidence:snapshot.terminationEvidence??null}
  if(typeof snapshot.messageId==='string'&&snapshot.messageId){
    facts.message_id=snapshot.messageId
    facts.session_id='main'
    facts.request_status='accepted'
  }
  if(outcome==='outcome_unknown')Object.assign(facts,{execution_status:'unknown',reply_status:'unknown',error_class:'OUTCOME_UNKNOWN'})
  else if(outcome==='terminated_without_outcome')Object.assign(facts,{execution_status:'interrupted',reply_status:'unknown',error_class:'OUTCOME_UNKNOWN'})
  else if(['failed','late_failed'].includes(outcome))Object.assign(facts,{execution_status:'failed',reply_status:'failed',error_class:'TARGET_RUN_FAILED'})
  else if(outcome==='not_admitted')Object.assign(facts,{request_status:'not_executed',execution_status:'not_started',reply_status:'unavailable',error_class:'NOT_EXECUTED'})
  else if(['completed','late_completed'].includes(outcome))facts.execution_status='completed'
  return {facts,completed:['completed','late_completed'].includes(outcome),pending:['pending','recovering'].includes(proof.state)}
}
