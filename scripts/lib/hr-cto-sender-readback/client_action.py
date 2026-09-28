# One fixed no-argument command. Filled only by future reviewed native-ID binding.
HR_CTO_FROZEN_REQUEST = None
HR_CTO_REQUEST_SHA256 = None


def hr_cto_owner_sender_readback():
    global SOCK
    packet = HR_CTO_FROZEN_REQUEST
    if packet is None or HR_CTO_REQUEST_SHA256 is None:
        raise RuntimeError('NATIVE_MESSAGE_ID_UNBOUND')
    if (type(packet) is not dict or set(packet) != {'action','operation_id','feishu_message_id'}
            or packet['action'] != 'HR_CTO_OWNER_SENDER_HASH_READBACK_V1'
            or packet['operation_id'] != 'hr-cto-owner-read-20260928-54b0945f'
            or type(packet['feishu_message_id']) is not str
            or not 0 < len(packet['feishu_message_id'].encode('utf-8')) <= 128
            or hashlib.sha256(json.dumps(packet,sort_keys=True,separators=(',',':')).encode()).hexdigest()
            != HR_CTO_REQUEST_SHA256):
        raise RuntimeError('FIXED_CTO_PACKET_INVALID')
    original_socket = SOCK
    try:
        SOCK = '/private/var/run/agent-deploy-system.sock'
        return request(packet)
    finally:
        SOCK = original_socket
