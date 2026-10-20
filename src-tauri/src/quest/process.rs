//! Whether a process is still running, and how to stop it.
//!
//! The app has to answer one question honestly: is the stub for this quest still
//! running? A flag the application set when it started the quest is not an answer —
//! the process may have died, or the machine may have rebooted. The process table
//! is the answer.
//!
//! The Windows implementation asks the kernel directly, through `kernel32`, so no
//! extra dependency is needed and no shell is involved. The Unix implementation
//! asks through `kill`, which is the same question asked the same way on every
//! Unix system.

/// Whether a process with this id is still running.
pub fn is_alive(pid: u32) -> bool {
    if pid == 0 {
        return false;
    }
    #[cfg(windows)]
    {
        windows::is_alive(pid)
    }
    #[cfg(unix)]
    {
        unix::is_alive(pid)
    }
    #[cfg(not(any(windows, unix)))]
    {
        // Nothing to ask. The caller falls back to the stub's presence on disk.
        true
    }
}

/// Stop a process by its id.
///
/// The process is signalled by id and by nothing else. A process that happens to share
/// the stub's image name is not touched.
pub fn terminate(pid: u32) -> bool {
    if pid == 0 {
        return false;
    }
    #[cfg(windows)]
    {
        windows::terminate(pid)
    }
    #[cfg(unix)]
    {
        unix::terminate(pid)
    }
    #[cfg(not(any(windows, unix)))]
    {
        let _ = pid;
        false
    }
}

#[cfg(windows)]
mod windows {
    use std::ffi::c_void;

    #[link(name = "kernel32")]
    extern "system" {
        fn OpenProcess(desired_access: u32, inherit_handle: i32, process_id: u32) -> *mut c_void;
        fn WaitForSingleObject(handle: *mut c_void, milliseconds: u32) -> u32;
        fn TerminateProcess(handle: *mut c_void, exit_code: u32) -> i32;
        fn CloseHandle(object: *mut c_void) -> i32;
    }

    /// The right to wait for a process.
    const SYNCHRONIZE: u32 = 0x0010_0000;
    /// The right to terminate a process.
    const PROCESS_TERMINATE: u32 = 0x0001;
    /// The wait timed out, which means the process is still running.
    const WAIT_TIMEOUT: u32 = 0x0000_0102;

    /// Whether the process is still running.
    ///
    /// The process object is signalled when the process exits, so the wait is what
    /// answers the question. Opening the process alone would not: a process that
    /// has exited but whose object has not been collected yet still opens.
    pub fn is_alive(pid: u32) -> bool {
        unsafe {
            let handle = OpenProcess(SYNCHRONIZE, 0, pid);
            if handle.is_null() {
                return false;
            }
            let signalled = WaitForSingleObject(handle, 0);
            CloseHandle(handle);
            signalled == WAIT_TIMEOUT
        }
    }

    pub fn terminate(pid: u32) -> bool {
        unsafe {
            let handle = OpenProcess(PROCESS_TERMINATE, 0, pid);
            if handle.is_null() {
                return false;
            }
            let stopped = TerminateProcess(handle, 1) != 0;
            CloseHandle(handle);
            stopped
        }
    }
}

#[cfg(unix)]
mod unix {
    extern "C" {
        fn kill(pid: i32, signal: i32) -> i32;
    }

    /// `SIGTERM`: the polite request to stop. A runner that has a window may need
    /// to close it, and a signal it can handle is better than one it cannot.
    const SIGTERM: i32 = 15;
    /// Signal zero asks whether a process exists without touching it.
    const SIGNAL_EXISTS: i32 = 0;
    /// `EPERM`: the process exists, but it belongs to somebody else.
    const EPERM: i32 = 1;

    pub fn is_alive(pid: u32) -> bool {
        // A process this user does not own reports a permission error rather than
        // "no such process", so a failure is not proof of absence: the process is
        // alive whenever the question cannot be answered with "no".
        //
        // The error is read through the standard library rather than through the C
        // library's `errno` directly. `errno` is a macro over a thread-local
        // variable, not a function, and declaring it as one and calling it
        // dereferences a variable as though it were code.
        unsafe {
            if kill(pid as i32, SIGNAL_EXISTS) == 0 {
                return true;
            }

            std::io::Error::last_os_error().raw_os_error() == Some(EPERM)
        }
    }

    pub fn terminate(pid: u32) -> bool {
        unsafe { kill(pid as i32, SIGTERM) == 0 }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A process that exits immediately.
    #[cfg(windows)]
    fn short_lived_child() -> std::process::Child {
        std::process::Command::new("cmd")
            .args(["/C", "exit"])
            .spawn()
            .expect("a child")
    }

    #[cfg(unix)]
    fn short_lived_child() -> std::process::Child {
        std::process::Command::new("true").spawn().expect("a child")
    }

    #[test]
    fn a_process_that_never_existed_is_not_alive() {
        assert!(!is_alive(0));
    }

    #[test]
    fn this_process_is_alive() {
        assert!(is_alive(std::process::id()));
    }

    #[test]
    fn a_process_that_has_exited_is_not_alive() {
        // The child is dropped inside the block, so its handle is closed and the
        // operating system's entry for it is released.
        let pid = {
            let mut child = short_lived_child();
            child.wait().expect("the child exits");
            child.id()
        };

        assert!(!is_alive(pid), "the process is gone");
    }

    #[test]
    fn a_process_that_never_existed_cannot_be_terminated() {
        assert!(!terminate(0));
    }
}
