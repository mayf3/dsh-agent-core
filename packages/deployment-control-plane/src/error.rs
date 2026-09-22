#[derive(Debug)]
pub struct Error {
    code: &'static str,
    /// Optional failing-object path (or other decisive context).  Never part
    /// of `code`: equality and digest matching keep working on the bare code,
    /// while Display carries the context so one probe run pinpoints the
    /// object instead of burning an attempt on a bare code.
    context: Option<String>,
}
pub type Result<T> = std::result::Result<T, Error>;
impl Error {
    pub fn new(code: &'static str) -> Self {
        Self {
            code,
            context: None,
        }
    }
    pub fn code(&self) -> &'static str {
        self.code
    }
    pub(crate) fn context(mut self, value: impl Into<String>) -> Self {
        self.context = Some(value.into());
        self
    }
}
impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match &self.context {
            Some(context) => write!(f, "{}:{}", self.code, context),
            None => f.write_str(self.code),
        }
    }
}
impl std::error::Error for Error {}
impl From<rusqlite::Error> for Error {
    fn from(_: rusqlite::Error) -> Self {
        Self::new("STORE_FAILURE")
    }
}
impl From<serde_json::Error> for Error {
    fn from(_: serde_json::Error) -> Self {
        Self::new("INVALID_RECORD")
    }
}
pub(crate) fn require(ok: bool, code: &'static str) -> Result<()> {
    if ok {
        Ok(())
    } else {
        Err(Error::new(code))
    }
}

impl From<std::io::Error> for Error {
    fn from(_: std::io::Error) -> Self {
        Self::new("FILESYSTEM_IO")
    }
}
