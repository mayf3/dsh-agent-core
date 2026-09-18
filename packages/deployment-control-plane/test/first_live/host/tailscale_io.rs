use super::*;
use std::{
    io::{Read, Write},
    time::Duration,
};
#[test]
fn immediate_fin_and_delayed_body_complete_with_one_total_deadline() {
    for delay in [0, 20] {
        let (mut client, mut server) = UnixStream::pair().unwrap();
        let child = std::thread::spawn(move || {
            let mut request = vec![];
            let mut b = [0u8; 1];
            while !request.ends_with(b"\r\n\r\n") {
                server.read_exact(&mut b).unwrap();
                request.push(b[0]);
            }
            assert_eq!(request,b"GET /localapi/v0/status?peers=false HTTP/1.0\r\nHost: local-tailscaled.sock\r\nConnection: close\r\n\r\n");
            std::thread::sleep(Duration::from_millis(delay));
            server.write_all(b"response").unwrap();
        });
        let result = exchange(&mut client, Instant::now() + Duration::from_secs(1));
        assert_eq!(result.unwrap(), b"response");
        child.join().unwrap();
    }
}
#[test]
fn hung_peer_and_continuous_stream_cannot_extend_total_budget() {
    for stream in [false, true] {
        let (mut client, mut server) = UnixStream::pair().unwrap();
        let child = std::thread::spawn(move || {
            let mut b = [0u8; 256];
            let _ = server.read(&mut b);
            if stream {
                for _ in 0..100 {
                    if server.write_all(b"x").is_err() {
                        break;
                    };
                    std::thread::sleep(Duration::from_millis(2));
                }
            } else {
                std::thread::sleep(Duration::from_millis(150));
            }
        });
        let start = Instant::now();
        assert!(exchange(&mut client, start + Duration::from_millis(40)).is_err());
        assert!(start.elapsed() < Duration::from_millis(120));
        drop(client);
        child.join().unwrap();
    }
}
