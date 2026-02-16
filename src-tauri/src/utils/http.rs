use std::sync::OnceLock;
use std::time::Duration;

static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

/// Returns a shared, lazily-initialized HTTP client with robust settings.
///
/// Using a singleton avoids creating a new client (and a new connection pool /
/// TLS session) on every request, which dramatically improves latency after the
/// first call and prevents resource leaks.
///
/// On Windows this automatically uses the Schannel TLS backend (via the
/// `native-tls` feature) so that the OS certificate store, corporate proxies
/// and antivirus HTTPS interception all work out-of-the-box.
pub fn get_client() -> reqwest::Result<reqwest::Client> {
    // If the client is already initialised, return a cheap clone (it's an Arc
    // internally).
    if let Some(client) = HTTP_CLIENT.get() {
        return Ok(client.clone());
    }

    let client = build_client()?;

    // Another thread may have raced us; that's fine – OnceLock will keep the
    // first one and drop ours, but both are equivalent.
    Ok(HTTP_CLIENT.get_or_init(|| client).clone())
}

fn build_client() -> reqwest::Result<reqwest::Client> {
    reqwest::Client::builder()
        // ── Identity ────────────────────────────────────────────────
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
        // ── Timeouts ────────────────────────────────────────────────
        // Time allowed to establish a TCP connection.
        .connect_timeout(Duration::from_secs(15))
        // Total time allowed for the entire request (connect + TLS + transfer).
        .timeout(Duration::from_secs(30))
        // ── Connection pool ─────────────────────────────────────────
        // Close idle keep-alive connections after 90 s to avoid stale sockets
        // (especially relevant behind NATs / firewalls on Windows).
        .pool_idle_timeout(Duration::from_secs(90))
        // Limit per-host connection pool to prevent resource exhaustion.
        .pool_max_idle_per_host(5)
        // ── TCP tuning ──────────────────────────────────────────────
        .tcp_nodelay(true)
        .tcp_keepalive(Duration::from_secs(60))
        // ── TLS ─────────────────────────────────────────────────────
        // `native-tls` is enabled in Cargo.toml which means:
        //   • Windows  → Schannel  (fully integrated with the OS cert store)
        //   • Linux    → OpenSSL
        //   • macOS    → Secure Transport
        // Accept slightly older TLS for maximum server compatibility.
        .min_tls_version(reqwest::tls::Version::TLS_1_2)
        // ── Redirects ───────────────────────────────────────────────
        .redirect(reqwest::redirect::Policy::limited(10))
        // ── Compression ─────────────────────────────────────────────
        .gzip(true)
        .brotli(true)
        .build()
}
