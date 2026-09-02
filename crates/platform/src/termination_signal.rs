//! Cooperative termination for a supervising Launcher.
//!
//! The Launcher owns a managed Codex Desktop plus a Desktop Controller child.
//! Its supervision loop stops both on a normal Desktop exit, and the
//! `SupervisedChild` guard kills the Controller when the Launcher unwinds. A
//! termination signal (`kill`, service shutdown, `Ctrl+C` before detaching)
//! bypasses both paths and used to leave the Controller running with no
//! Launcher to reap it. This module turns those signals into a flag the
//! supervision loop polls, so the Launcher can run its ordinary teardown.

use std::sync::atomic::{AtomicBool, Ordering};

use super::PlatformError;

static TERMINATION_REQUESTED: AtomicBool = AtomicBool::new(false);

#[cfg(any(target_os = "macos", target_os = "linux"))]
extern "C" fn record_termination(_signal: i32) {
    // Only an atomic store: everything else stays async-signal-safe.
    TERMINATION_REQUESTED.store(true, Ordering::SeqCst);
}

/// Routes `SIGTERM`, `SIGINT`, and `SIGHUP` into [`termination_requested`]
/// instead of the default immediate exit. Call it only once supervision is
/// established; before that the default disposition still cancels a launch.
#[cfg(any(target_os = "macos", target_os = "linux"))]
pub fn install_termination_signal_flag() -> Result<(), PlatformError> {
    use nix::sys::signal::{SaFlags, SigAction, SigHandler, SigSet, Signal, sigaction};

    let action = SigAction::new(
        SigHandler::Handler(record_termination),
        SaFlags::empty(),
        SigSet::empty(),
    );
    for signal in [Signal::SIGTERM, Signal::SIGINT, Signal::SIGHUP] {
        // SAFETY: the handler is a plain `extern "C"` function that performs a
        // single atomic store and touches no other state, so it is
        // async-signal-safe; the previous disposition is not needed again.
        unsafe { sigaction(signal, &action) }.map_err(|error| {
            PlatformError::Io(std::io::Error::other(format!(
                "install {signal} handler failed: {error}"
            )))
        })?;
    }
    Ok(())
}

/// Windows has no POSIX signals here; console control events are already
/// ignored after detaching, so there is nothing to route.
#[cfg(target_os = "windows")]
pub fn install_termination_signal_flag() -> Result<(), PlatformError> {
    Ok(())
}

/// `true` once a termination signal arrived after
/// [`install_termination_signal_flag`]. Never resets on its own.
#[must_use]
pub fn termination_requested() -> bool {
    TERMINATION_REQUESTED.load(Ordering::SeqCst)
}

#[cfg(test)]
mod tests {
    use super::termination_requested;

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    #[test]
    fn a_termination_signal_sets_the_flag_instead_of_exiting() {
        use nix::sys::signal::{Signal, raise};

        use super::install_termination_signal_flag;

        install_termination_signal_flag().expect("install handlers");
        // Delivered to this test process; with the handler installed it must
        // only flip the flag rather than terminate the test binary.
        raise(Signal::SIGTERM).expect("raise SIGTERM");
        assert!(termination_requested());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_never_reports_a_termination_signal() {
        super::install_termination_signal_flag().expect("no-op install");
        assert!(!termination_requested());
    }
}
