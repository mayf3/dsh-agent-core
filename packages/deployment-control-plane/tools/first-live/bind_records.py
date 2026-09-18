"""Pure binding before the once-only host/custody/login operation.

Only the observed fixed platform-tool digest is inserted. Future custody keys,
login results and PASS are never predicted here. Native code independently
validates the protected tool, exact packet and subsequent runtime proofs.
"""
import hashlib
import json


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


def _sudo_digest(line):
    # The outer operator must first authenticate the fixed OS entry and check
    # its exact frozen tuple/ACL before and after this observed command output.
    suffix = b"  /usr/bin/sudo\n"
    _require(isinstance(line, bytes) and len(line) == 64 + len(suffix)
             and line.endswith(suffix)
             and all(c in b"0123456789abcdef" for c in line[:64]), "SUDO_DIGEST_OBSERVATION")
    return line[:64].decode("ascii")


def bind_packet(template_raw, template_sha256, sudo_line):
    """Bind the fixed sudo observation without requiring a prior device login.

    This is a public-byte transformation, not a grant, protected observation or
    readiness proof. The outer exact operator must authenticate the OS tool and
    frozen metadata before producing sudo_line and revalidate before execution.
    """
    template = _object(template_raw, 16 * 1024 * 1024)
    _require(_sha(template_raw) == template_sha256, "TEMPLATE_DIGEST")
    previous = template.get("previous")
    _require(isinstance(previous, dict), "PREVIOUS_BINDING")
    _require("login_receipt_sha256" not in previous
             and "custody_receipt_sha256" not in previous, "PREFILLED_FUTURE_RECEIPT")
    issuers = template.get("issuer_bindings")
    _require(isinstance(issuers, list) and len(issuers) == 6, "ISSUER_TEMPLATE")
    for issuer in issuers:
        _require(isinstance(issuer, dict) and "public_key" in issuer
                 and "custody_receipt" in issuer and issuer["public_key"] is None
                 and issuer["custody_receipt"] is None, "PREFILLED_FUTURE_CUSTODY")
    lifecycle = template.get("lifecycle")
    _require(isinstance(lifecycle, dict), "LIFECYCLE_BINDING")
    tools = lifecycle.get("tool_sha256")
    _require(isinstance(tools, dict), "TOOL_BINDING")
    _require("/usr/bin/sudo" not in tools, "PREFILLED_SUDO_DIGEST")
    tools["/usr/bin/sudo"] = _sudo_digest(sudo_line)
    return _canonical(template)
