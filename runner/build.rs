//! Linker directives for the runner executable.
//!
//! The runner is a silent process: it shows no window, no console and no tray
//! icon. That is enforced at link time rather than at run time, so nothing can
//! accidentally opt back in.

fn main() {
    // The Windows subsystem, not the console one. The runner has no console
    // window to flash, and no stdout or stderr handle to inherit.
    println!("cargo:rustc-link-arg=/SUBSYSTEM:WINDOWS");

    // There is no `main` to call, so the entry point is named explicitly and the
    // CRT startup path is never reached.
    println!("cargo:rustc-link-arg=/ENTRY:mainEntryPoint");

    println!("cargo:rerun-if-changed=src/main.rs");
    println!("cargo:rerun-if-changed=build.rs");
}
