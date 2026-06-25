pub mod schema;

#[cfg(test)]
mod schema_tests;

pub use schema::{Database, init_database, get_db};
