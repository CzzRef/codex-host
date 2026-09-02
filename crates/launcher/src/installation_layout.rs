use std::env;
use std::ffi::OsStr;
use std::path::{Path, PathBuf};

#[derive(Debug, PartialEq, Eq)]
pub struct InstalledResources {
    pub shim: PathBuf,
    pub node: PathBuf,
    pub host_runtime: PathBuf,
    pub desktop_controller: PathBuf,
    pub renderer_extension: PathBuf,
}

/// Host Runtime entry for a Launcher running straight out of a source checkout
/// (`<root>/target/{debug,release}/codexhost`) instead of an install tree.
///
/// It mirrors the development layout `tools/dev-desktop/run.mjs` already owns:
/// `npm start` hands those paths to `launch` on the command line, but the
/// delegation CLI is invoked by other processes through `CODEXHOST_CLI_PATH`
/// with no flags to carry them, so it has to recognise the layout itself.
/// Returns `None` whenever the shape does not match or the bundle is absent,
/// so an installed Launcher keeps using its own resources.
pub fn source_checkout_host_runtime(executable: &Path) -> Option<PathBuf> {
    let profile_directory = executable.parent()?;
    let profile = profile_directory.file_name()?;
    if profile != OsStr::new("debug") && profile != OsStr::new("release") {
        return None;
    }
    let source_root = profile_directory.parent()?.parent()?;
    let host_runtime = source_root.join("packages/host-runtime/dist/main.js");
    host_runtime.is_file().then_some(host_runtime)
}

impl InstalledResources {
    pub fn from_current_executable() -> Result<Self, String> {
        let executable = env::current_exe()
            .map_err(|error| format!("cannot locate the codexhost executable: {error}"))?;
        Self::from_executable(&executable)
    }

    pub fn from_executable(executable: &Path) -> Result<Self, String> {
        if !executable.is_absolute() {
            return Err(format!(
                "codexhost executable path must be absolute: {}",
                executable.display()
            ));
        }
        let executable_directory = executable.parent().ok_or_else(|| {
            format!(
                "codexhost executable has no installation directory: {}",
                executable.display()
            )
        })?;
        let installation_root = executable_directory.parent().ok_or_else(|| {
            format!(
                "codexhost executable must be installed below an installation root: {}",
                executable.display()
            )
        })?;
        let resource_root = if executable_directory.file_name() == Some(OsStr::new("MacOS"))
            && installation_root.file_name() == Some(OsStr::new("Contents"))
        {
            installation_root.join("Resources")
        } else {
            installation_root.to_path_buf()
        };
        let executable_suffix = env::consts::EXE_SUFFIX;

        Ok(Self {
            shim: resource_root
                .join("libexec")
                .join(format!("codexhost-shim{executable_suffix}")),
            node: resource_root
                .join("runtime")
                .join(format!("node{executable_suffix}")),
            host_runtime: resource_root.join("app/host-runtime.mjs"),
            desktop_controller: resource_root.join("app/desktop-controller.mjs"),
            renderer_extension: resource_root.join("app/renderer-extension.js"),
        })
    }
}

#[cfg(test)]
mod tests {
    use std::env;
    use std::path::Path;

    use super::InstalledResources;
    use super::source_checkout_host_runtime;

    #[test]
    fn resolves_resources_from_a_release_bin_directory() {
        let root = env::temp_dir().join("codexhost release");
        let executable = root
            .join("bin")
            .join(format!("codexhost{}", env::consts::EXE_SUFFIX));

        assert_eq!(
            InstalledResources::from_executable(&executable).expect("release layout"),
            InstalledResources {
                shim: root
                    .join("libexec")
                    .join(format!("codexhost-shim{}", env::consts::EXE_SUFFIX)),
                node: root
                    .join("runtime")
                    .join(format!("node{}", env::consts::EXE_SUFFIX)),
                host_runtime: root.join("app/host-runtime.mjs"),
                desktop_controller: root.join("app/desktop-controller.mjs"),
                renderer_extension: root.join("app/renderer-extension.js"),
            }
        );
    }

    #[test]
    fn resolves_resources_from_a_macos_bundle_contents_directory() {
        let contents = env::temp_dir().join("codexhost.app/Contents");
        let executable = contents
            .join("MacOS")
            .join(format!("codexhost{}", env::consts::EXE_SUFFIX));

        assert_eq!(
            InstalledResources::from_executable(&executable)
                .expect("macOS application layout")
                .host_runtime,
            contents.join("Resources/app/host-runtime.mjs")
        );
    }

    #[test]
    fn ignores_a_source_checkout_layout_without_a_built_host_runtime() {
        let executable = env::temp_dir()
            .join("codexhost-missing-bundle/target/debug")
            .join(format!("codexhost{}", env::consts::EXE_SUFFIX));

        assert_eq!(source_checkout_host_runtime(&executable), None);
    }

    #[test]
    fn ignores_an_installed_layout_that_is_not_a_cargo_profile_directory() {
        let executable = env::temp_dir()
            .join("codexhost-install/bin")
            .join(format!("codexhost{}", env::consts::EXE_SUFFIX));

        assert_eq!(source_checkout_host_runtime(&executable), None);
    }

    #[test]
    fn rejects_a_relative_executable_path() {
        let error = InstalledResources::from_executable(Path::new("bin/codexhost"))
            .expect_err("relative executable must fail");
        assert!(error.contains("must be absolute"));
    }
}
