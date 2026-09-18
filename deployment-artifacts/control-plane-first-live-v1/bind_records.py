"""Pure preparation of fixed public run records; no filesystem, auth or root I/O.

The future reviewed operator must supply bytes actually read from the protected
successful helper receipt. Computing an expected postimage never establishes it.
"""
import hashlib
import json

MANIFEST = "829054c0a16c9b5784bc9c124b6310bf17f055c3c9f31b46046f06a931331f47"
HELPER = "185ea8351830776cdd29fcc2ba795836a938d361e66763bc944545b83833e1e6"
ORIGINAL_INTENT = "3ca4b44d4d3e418ea78df8ad6c0a04b7a650e0006c807ffd9f96441b0d10abc6"
FIXED_GRANT = {
    "version": 1,
    "owner": "mayf3",
    "scope": "EXACT_REVIEWER_LOGIN_RECONCILIATION_ONLY",
    "manifest_digest": MANIFEST,
    "helper_digest": HELPER,
}


def _require(value, reason):
    if not value:
        raise ValueError(reason)


def _canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def _sha(raw):
    return hashlib.sha256(raw).hexdigest()


def _unique(pairs):
    value = {}
    for key, item in pairs:
        _require(key not in value, "DUPLICATE_JSON_KEY")
        value[key] = item
    return value


def _object(raw, maximum):
    _require(isinstance(raw, bytes) and 0 < len(raw) <= maximum, "PUBLIC_RECORD_SIZE")
    try:
        value = json.loads(raw, object_pairs_hook=_unique,
                           parse_constant=lambda _: (_ for _ in ()).throw(ValueError("NONFINITE_JSON")))
    except (UnicodeError, RecursionError) as error:
        raise ValueError("PUBLIC_RECORD_JSON") from error
    _require(isinstance(value, dict), "PUBLIC_RECORD_OBJECT")
    return value


def _issued_at(value):
    _require(type(value) is int and 0 <= value <= (2**64 - 1) - 3600, "GRANT_TIME")
    return value


def login_grant(issued_at):
    """Exact reviewed one-hour grant bytes; caller records actual clock once."""
    issued_at = _issued_at(issued_at)
    return _canonical({**FIXED_GRANT, "issued_at": issued_at, "expires_at": issued_at + 3600})


def expected_login_receipt(grant_raw):
    """Expected bytes only. Native helper still must execute and publish them."""
    grant = _object(grant_raw, 65536)
    _require(set(grant) == set(FIXED_GRANT) | {"issued_at", "expires_at"}, "GRANT_FIELDS")
    _require(type(grant["version"]) is int, "GRANT_VERSION")
    _require(all(grant[key] == value for key, value in FIXED_GRANT.items()), "GRANT_BINDING")
    start = _issued_at(grant["issued_at"])
    _require(type(grant["expires_at"]) is int and grant["expires_at"] == start + 3600, "GRANT_TIME")
    return _canonical({
        "version": 1,
        "manifest_digest": MANIFEST,
        "grant_digest": _sha(grant_raw),  # Native hashes raw input, not semantic reserialization.
        "original_intent_digest": ORIGINAL_INTENT,
        "state": "SEPARATE_LOGIN_COMMAND_COMPLETED_SAFE_LOCAL_AUTH_METADATA",
        "original_provider_outcome": "UNKNOWN_RETAINED",
        "independent_review_pass": False,
        "activation_allowed": False,
    })


def _sudo_digest(line):
    # The outer operator must first authenticate the fixed OS entry and check
    # its exact frozen tuple/ACL before and after this observed command output.
    suffix = b"  /usr/bin/sudo\n"
    _require(isinstance(line, bytes) and len(line) == 64 + len(suffix)
             and line.endswith(suffix)
             and all(c in b"0123456789abcdef" for c in line[:64]), "SUDO_DIGEST_OBSERVATION")
    return line[:64].decode("ascii")


def bind_packet(template_raw, template_sha256, observed_receipt_raw, grant_raw, sudo_line):
    """Insert only checked login-receipt and fixed-sudo digests into the template.

    This is an ordinary byte transformation, not a proof or admission API. The
    native entry independently reads the real protected receipt and validates
    the complete typed packet, grant, mutex, current state and all preimages.
    """
    template = _object(template_raw, 16 * 1024 * 1024)
    _require(_sha(template_raw) == template_sha256, "TEMPLATE_DIGEST")
    _require(isinstance(observed_receipt_raw, bytes)
             and observed_receipt_raw == expected_login_receipt(grant_raw), "LOGIN_OBSERVATION_REQUIRED")
    previous = template.get("previous")
    _require(isinstance(previous, dict), "PREVIOUS_BINDING")
    _require("login_receipt_sha256" not in previous, "PREFILLED_LOGIN_RECEIPT")
    lifecycle = template.get("lifecycle")
    _require(isinstance(lifecycle, dict), "LIFECYCLE_BINDING")
    tools = lifecycle.get("tool_sha256")
    _require(isinstance(tools, dict), "TOOL_BINDING")
    _require("/usr/bin/sudo" not in tools, "PREFILLED_SUDO_DIGEST")
    tools["/usr/bin/sudo"] = _sudo_digest(sudo_line)
    previous["login_receipt_sha256"] = _sha(observed_receipt_raw)
    return _canonical(template)
