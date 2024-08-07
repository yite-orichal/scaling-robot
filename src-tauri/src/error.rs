use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct AppError {
    pub err_msg: String,
}

impl AppError {
    pub fn new(msg: impl Into<String>) -> Self {
        Self {
            err_msg: msg.into(),
        }
    }
}

impl<T> From<T> for AppError
where
    T: std::error::Error,
{
    fn from(value: T) -> Self {
        Self {
            err_msg: format!("{value}"),
        }
    }
}
