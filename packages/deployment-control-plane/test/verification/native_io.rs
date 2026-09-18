use super::*;
#[test]
fn only_complete_single_length_authenticated_endpoint_response_is_decoded() {
    let good = b"HTTP/1.1 200 OK\r\ncontent-length: 2\r\n\r\n{}";
    assert_eq!(decode_response(good).unwrap(), b"{}");
    for raw in [
        b"HTTP/1.1 302 Redirect\r\ncontent-length: 2\r\n\r\n{}".as_slice(),
        b"HTTP/1.1 200 OK\r\ncontent-length: 3\r\n\r\n{}",
        b"HTTP/1.1 200 OK\r\ncontent-length: 2\r\nContent-Length: 2\r\n\r\n{}",
        b"HTTP/1.1 200 OK\r\ncontent-length: 2\r\ntransfer-encoding: chunked\r\n\r\n{}",
    ] {
        assert!(decode_response(raw).is_err())
    }
}
