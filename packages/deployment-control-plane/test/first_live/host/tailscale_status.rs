use super::*;
fn response(body: &str) -> Vec<u8> {
    format!(
        "HTTP/1.0 200 OK\r\nContent-Length: {}\r\n\r\n{}",
        body.len(),
        body
    )
    .into_bytes()
}
fn ready() -> String {
    r#"{"BackendState":"Running","Self":{"ID":"n:fixture","PublicKey":"nodekey:fixture"}}"#.into()
}
#[test]
fn ready_projection_discards_peer_addresses_and_names() {
    let good = ready();
    let expected = parse(&response(&good)).unwrap();
    let richer = good.replace(
        "\"BackendState\"",
        "\"Peers\":{\"private\":{}},\"BackendState\"",
    );
    assert_eq!(expected, parse(&response(&richer)).unwrap());
    assert_eq!(expected.len(), 64);
}
#[test]
fn not_running_missing_identity_duplicate_json_and_bad_http_fail_closed() {
    for body in [
        ready().replace("Running", "NeedsLogin"),
        ready().replace("n:fixture", ""),
        ready().replace(
            "\"ID\":\"n:fixture\"",
            "\"ID\":\"n:fixture\",\"ID\":\"other\"",
        ),
        "{}".into(),
    ] {
        assert!(parse(&response(&body)).is_err());
    }
    for raw in [
        b"HTTP/1.0 500 bad\r\n\r\n{}".to_vec(),
        response(&ready()).iter().copied().take(40).collect(),
        response(&ready())
            .into_iter()
            .chain(b"trailing".iter().copied())
            .collect(),
    ] {
        assert!(parse(&raw).is_err());
    }
}
#[test]
fn changed_stable_identity_changes_digest() {
    assert_ne!(
        parse(&response(&ready())).unwrap(),
        parse(&response(&ready().replace("n:fixture", "n:other"))).unwrap()
    );
}
