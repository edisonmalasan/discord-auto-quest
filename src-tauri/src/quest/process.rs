//! Whether a process is still running, and how to stop it.
//!
//! The app has to answer one question honestly: is the stub for this quest still
//! running? A flag the application set when it started the quest is not an answer —
//! the process may have died, or the machine may have rebooted. The process table
//! is the answer.
//!
//! The Windows implementation asks the kernel directly, through `kernel32`, so no
//! extra dependency is needed and no shell is involved.

/// Whether a process with this id is still running.
pub fn is_alive(pid: u32) -> bool {
    if pid == 0 {
        return false;
    }
    #[cfg(windows)]
    {
        windows::is_alive(pid)
    }
    #[cfg(target_os = "linux")]
    {
        std::path::Path::new(&format!("/proc/{pid}")).exists()
    }
    #[cfg(not(any(windows, target_os = "linux")))]
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
    #[cfg(not(windows))]
    {
        // The runners for other platforms are not built yet.
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
    /// The wait timed out, which means the process is still running. A process
    /// that has exited is signalled instead.
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

    #[cfg(not(windows))]
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
