// Only the projection is new. Full V3 validator prefix is inherited verbatim.
const d = readDurableRecoveryStore(process.argv[1]);
if (!d) throw new Error('STORE_ABSENT');
const selector = readFileSync(0, 'utf8');
if (!selector || Buffer.byteLength(selector, 'utf8') > 128) throw new Error('SELECTOR_INVALID');
const matches = [...d.records.values()].filter(record =>
  record.ingressCorrelation?.channelNamespace === 'feishu'
  && record.ingressCorrelation.feishuMessageId === selector);
let result;
if (matches.length === 0) result = {validator:'PASS', match:'NONE'};
else if (matches.length !== 1) result = {validator:'PASS', match:'MULTIPLE'};
else {
  const record = matches[0];
  if (record.agentId !== 'agt_cto-agent') result = {validator:'PASS', match:'WRONG_AGENT'};
  else if (typeof record.messageId !== 'string' || !record.messageId)
    result = {validator:'PASS', match:'RECEIPT_ABSENT'};
  else {
    const hash = value => createHash('sha256').update(value, 'utf8').digest('hex');
    result = {validator:'PASS', match:'ONE', projection:{
      sender_openid_sha256:hash(record.ingressCorrelation.feishuSenderOpenId),
      feishu_message_id_sha256:hash(record.ingressCorrelation.feishuMessageId),
      native_receipt_sha256:hash(record.messageId),
    }};
  }
}
console.log(JSON.stringify(result));
